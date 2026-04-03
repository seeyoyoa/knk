// USDT支付服务 - 支持TRC20/ERC20/BEP20
const crypto = require('crypto');
const { get, run, query } = require('../config/database');
const { logPayment } = require('./payment');

// 区块链浏览器API
const BLOCKCHAIN_APIS = {
  TRC20: {
    baseUrl: 'https://apilist.tronscanapi.com/api',
    headers: { 'TRON-PRO-API-KEY': '' }
  },
  ERC20: {
    baseUrl: 'https://api.etherscan.io/api'
  },
  BEP20: {
    baseUrl: 'https://api.bscscan.com/api'
  }
};

/**
 * 生成USDT收款地址和订单
 */
async function createUSDTOrder(orderId, userId, amountUSD, config) {
  try {
    const paymentId = crypto.randomUUID();
    const uniqueAddress = config.walletAddress; // 使用配置的钱包地址
    const expectedAmount = amountUSD; // USD金额
    
    // 生成支付订单
    await run(`
      INSERT INTO payments (id, order_id, user_id, amount, currency, method, status, qr_code, created_at)
      VALUES (?, ?, ?, ?, 'USD', 'usdt', 'pending', ?, CURRENT_TIMESTAMP)
    `, [
      paymentId,
      orderId,
      userId,
      expectedAmount,
      JSON.stringify({
        address: uniqueAddress,
        network: config.network,
        amount: expectedAmount,
        memo: `ORDER_${orderId}`
      })
    ]);

    // 更新订单
    await run(`
      UPDATE orders SET payment_method = 'usdt' WHERE id = ?
    `, [orderId]);

    // 生成二维码数据
    const qrData = `${config.network}:${uniqueAddress}?amount=${expectedAmount}&label=Payment_${orderId}`;

    await logPayment('usdt', 'USDT订单创建成功', {
      orderId,
      paymentId,
      network: config.network,
      address: uniqueAddress,
      amount: expectedAmount
    });

    return {
      success: true,
      paymentId,
      address: uniqueAddress,
      network: config.network,
      amount: expectedAmount,
      qrCode: qrData,
      orderId,
      timeout: config.timeout || 30
    };
  } catch (error) {
    await logPayment('usdt', 'USDT订单创建失败', {
      orderId,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 通过区块链API查询交易
 */
async function checkBlockchainTransaction(txHash, network, walletAddress) {
  try {
    const apiConfig = BLOCKCHAIN_APIS[network];
    if (!apiConfig) {
      throw new Error(`不支持的网络: ${network}`);
    }

    let response;
    
    if (network === 'TRC20') {
      // TronScan API查询TRC20转账
      const url = `${apiConfig.baseUrl}/transaction-info?hash=${txHash}`;
      response = await fetch(url, {
        headers: apiConfig.headers
      });
      
      const data = await response.json();
      
      if (data && data.confirmations > 0) {
        // 检查转账记录
        const transfersUrl = `${apiConfig.baseUrl}/transaction?hash=${txHash}`;
        const transferResponse = await fetch(transfersUrl, {
          headers: apiConfig.headers
        });
        const transferData = await transferResponse.json();
        
        if (transferData && transferData.transfersToken && transferData.transfersToken.length > 0) {
          const transfer = transferData.transfersToken[0];
          return {
            confirmed: true,
            from: transfer.from,
            to: transfer.to,
            amount: (transfer.amount / Math.pow(10, transfer.decimals)).toString(),
            confirmations: data.confirmations,
            timestamp: data.block_ts
          };
        }
      }
    } else if (network === 'ERC20' || network === 'BEP20') {
      // Etherscan/Bscscan API
      const apiKey = apiConfig.apiKey;
      const url = `${apiConfig.baseUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
      response = await fetch(url);
      
      const data = await response.json();
      
      if (data.result && data.result.blockNumber) {
        // 获取交易收据确认数
        const receiptUrl = `${apiConfig.baseUrl}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`;
        const receiptResponse = await fetch(receiptUrl);
        const receiptData = await receiptResponse.json();
        
        if (receiptData.result && receiptData.result.status === '0x1') {
          return {
            confirmed: true,
            from: data.result.from,
            to: data.result.to,
            amount: (parseInt(data.result.value) / 1e18).toString(),
            confirmations: parseInt(data.result.blockNumber),
            gasUsed: parseInt(receiptData.result.gasUsed)
          };
        }
      }
    }

    return { confirmed: false };
  } catch (error) {
    console.error('查询区块链交易失败:', error);
    return { confirmed: false, error: error.message };
  }
}

/**
 * 检查钱包地址的入账交易
 */
async function checkWalletIncomingTransactions(walletAddress, network, apiKey, sinceTimestamp) {
  try {
    const apiConfig = BLOCKCHAIN_APIS[network];
    let transactions = [];

    if (network === 'TRC20') {
      // 查询TRC20转账记录
      const url = `${apiConfig.baseUrl}/transfer?relatedAddress=${walletAddress}&limit=20&start=0&sort=-timestamp&startTime=${sinceTimestamp}`;
      const response = await fetch(url, {
        headers: apiConfig.headers
      });
      const data = await response.json();
      
      if (data.data) {
        transactions = data.data
          .filter(tx => tx.to === walletAddress && tx.tokenName === 'Tether USD')
          .map(tx => ({
            txHash: tx.transactionHash,
            from: tx.from,
            to: tx.to,
            amount: (tx.amount / Math.pow(10, tx.decimals)).toString(),
            timestamp: tx.block_ts,
            confirmations: tx.confirmations || 0,
            tokenSymbol: tx.tokenAbbr
          }));
      }
    } else if (network === 'ERC20') {
      const url = `${apiConfig.baseUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        transactions = data.result
          .filter(tx => tx.to === walletAddress.toLowerCase() && tx.tokenSymbol === 'USDT')
          .map(tx => ({
            txHash: tx.hash,
            from: tx.from,
            to: tx.to,
            amount: (parseInt(tx.value) / Math.pow(10, parseInt(tokenDecimals || 6))).toString(),
            timestamp: parseInt(tx.timeStamp),
            confirmations: parseInt(tx.confirmations || 0),
            tokenSymbol: tx.tokenSymbol
          }));
      }
    } else if (network === 'BEP20') {
      const url = `${apiConfig.baseUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        transactions = data.result
          .filter(tx => tx.to === walletAddress.toLowerCase() && tx.tokenSymbol === 'USDT')
          .map(tx => ({
            txHash: tx.hash,
            from: tx.from,
            to: tx.to,
            amount: (parseInt(tx.value) / Math.pow(10, 18)).toString(),
            timestamp: parseInt(tx.timeStamp),
            confirmations: parseInt(tx.confirmations || 0),
            tokenSymbol: tx.tokenSymbol
          }));
      }
    }

    return { success: true, transactions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 处理USDT支付回调
 */
async function handleUSDTCallback(callbackData, config) {
  try {
    const { txHash, from, to, amount, network, timestamp } = callbackData;

    // 验证收款地址
    if (to !== config.walletAddress) {
      return { success: false, message: '收款地址不匹配' };
    }

    // 查找待确认的支付订单
    const pendingPayments = await query(`
      SELECT p.*, o.plan_id, o.user_id 
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE p.method = 'usdt' 
        AND p.status IN ('pending', 'paid')
        AND o.status = 'pending'
    `);

    let matchedPayment = null;
    
    // 匹配金额
    for (const payment of pendingPayments) {
      const paymentInfo = JSON.parse(payment.qr_code || '{}');
      if (Math.abs(parseFloat(amount) - paymentInfo.amount) < 0.01) {
        matchedPayment = payment;
        break;
      }
    }

    if (!matchedPayment) {
      return { success: false, message: '未找到匹配的订单' };
    }

    // 更新支付状态
    await run(`
      UPDATE payments 
      SET status = 'confirmed', 
          trade_no = ?, 
          paid_at = ?, 
          confirmed_at = CURRENT_TIMESTAMP,
          notify_data = ?
      WHERE id = ?
    `, [txHash, new Date(timestamp * 1000).toISOString(), JSON.stringify(callbackData), matchedPayment.id]);

    // 更新订单状态
    await run(`
      UPDATE orders 
      SET status = 'paid', 
          paid_at = ? 
      WHERE id = ?
    `, [new Date(timestamp * 1000).toISOString(), matchedPayment.order_id]);

    // 开通套餐
    await activatePlan(matchedPayment.order_id);

    await logPayment('usdt', 'USDT支付确认成功', {
      txHash,
      amount,
      orderId: matchedPayment.order_id,
      userId: matchedPayment.user_id
    });

    return { success: true, orderId: matchedPayment.order_id };
  } catch (error) {
    console.error('处理USDT回调失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 开通套餐
 */
async function activatePlan(orderId) {
  try {
    const order = await get(`
      SELECT o.*, p.duration, p.data_limit, p.speed_limit, p.node_groups
      FROM orders o
      JOIN plans p ON o.plan_id = p.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      throw new Error('订单不存在');
    }

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + order.duration);

    // 生成订阅token
    const subscriptionToken = crypto.randomBytes(16).toString('hex');

    // 更新用户套餐
    await run(`
      UPDATE users 
      SET plan_id = ?, 
          plan_expire = ?, 
          data_limit = ?, 
          subscription_token = ?,
          status = 'active'
      WHERE id = ?
    `, [order.plan_id, expireDate.toISOString(), order.data_limit, subscriptionToken, order.user_id]);

    await logPayment('system', '套餐开通成功', {
      orderId,
      userId: order.user_id,
      planId: order.plan_id,
      expireDate: expireDate.toISOString(),
      subscriptionToken
    });

    return {
      success: true,
      subscriptionToken,
      expireDate: expireDate.toISOString()
    };
  } catch (error) {
    console.error('开通套餐失败:', error);
    throw error;
  }
}

/**
 * 获取USDT汇率
 */
async function getUSDTExchangeRate() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny');
    const data = await response.json();
    return data.tether?.cny || 7.2;
  } catch (error) {
    console.error('获取USDT汇率失败:', error);
    return 7.2; // 默认汇率
  }
}

module.exports = {
  createUSDTOrder,
  checkBlockchainTransaction,
  checkWalletIncomingTransactions,
  handleUSDTCallback,
  activatePlan,
  getUSDTExchangeRate
};
