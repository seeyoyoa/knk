const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { authAdmin, optionalAuth } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

const router = express.Router();

// ============ HTTP 请求工具 ============
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchUrl(res.headers.location, timeout));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({
          data,
          headers: res.headers,
          statusCode: res.statusCode,
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
  });
}

// ============ Base64 解码（支持各种编码） ============
function decodeBase64Safe(str) {
  try {
    // 移除空白字符
    str = str.replace(/\s/g, '');
    // 补齐 base64
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

// ============ 解析单个节点 URI ============
function parseNodeUri(uri) {
  uri = uri.trim();
  if (!uri) return null;
  
  try {
    // VMess: vmess://base64(json)
    if (uri.startsWith('vmess://')) {
      const jsonStr = decodeBase64Safe(uri.slice(8));
      if (!jsonStr) return null;
      const obj = JSON.parse(jsonStr);
      return {
        name: obj.ps || obj.remarks || 'VMess Node',
        type: 'vmess',
        server: obj.add,
        port: parseInt(obj.port),
        uuid: obj.id,
        alterId: parseInt(obj.aid) || 0,
        cipher: obj.scy || 'auto',
        network: obj.net || 'tcp',
        tls: obj.tls === 'tls',
        host: obj.host || '',
        path: obj.path || '',
        sni: obj.sni || obj.host || '',
        isActive: true,
      };
    }
    
    // VLESS: vless://uuid@server:port?params#name
    if (uri.startsWith('vless://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'VLESS Node',
        type: 'vless',
        server: url.hostname,
        port: parseInt(url.port),
        uuid: url.username,
        network: params.type || 'tcp',
        tls: params.security === 'tls' || params.security === 'xtls',
        host: params.host || '',
        path: params.path || '',
        sni: params.sni || '',
        flow: params.flow || '',
        alpn: params.alpn || '',
        isActive: true,
      };
    }
    
    // Trojan: trojan://password@server:port?params#name
    if (uri.startsWith('trojan://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'Trojan Node',
        type: 'trojan',
        server: url.hostname,
        port: parseInt(url.port),
        password: url.username,
        network: params.type || 'tcp',
        sni: params.sni || '',
        host: params.host || '',
        path: params.path || '',
        alpn: params.alpn || '',
        isActive: true,
      };
    }
    
    // SS: ss://base64(method:password)@server:port#name 或 ss://method:password@server:port#name
    if (uri.startsWith('ss://')) {
      const hashIndex = uri.indexOf('#');
      const name = hashIndex > 0 ? decodeURIComponent(uri.slice(hashIndex + 1)) : 'SS Node';
      const uriWithoutName = hashIndex > 0 ? uri.slice(0, hashIndex) : uri;
      
      // 尝试 SIP002 格式
      const atIndex = uriWithoutName.indexOf('@');
      if (atIndex > 5) {
        let userInfo = uriWithoutName.slice(5, atIndex);
        const serverPort = uriWithoutName.slice(atIndex + 1);
        
        // 尝试 base64 解码
        const decoded = decodeBase64Safe(userInfo);
        if (decoded && decoded.includes(':')) {
          const [method, ...passParts] = decoded.split(':');
          const password = passParts.join(':');
          const [server, port] = serverPort.split(':');
          return {
            name, type: 'ss', server, port: parseInt(port),
            cipher: method, password, isActive: true,
          };
        }
        
        // 直接格式
        const [server, port] = serverPort.split(':');
        return {
          name, type: 'ss', server, port: parseInt(port),
          cipher: 'aes-256-gcm', password: userInfo, isActive: true,
        };
      }
    }
    
    // Hysteria2: hysteria2://auth@server:port/?params#name
    if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'Hysteria2 Node',
        type: 'hysteria2',
        server: url.hostname,
        port: parseInt(url.port),
        password: url.username || params.auth || '',
        sni: params.sni || '',
        alpn: params.obfs || '',
        isActive: true,
      };
    }
    
    // TUIC: tuic://uuid:password@server:port?params#name
    if (uri.startsWith('tuic://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      const [uuid, password] = (url.username || '').split(':');
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'TUIC Node',
        type: 'tuic',
        server: url.hostname,
        port: parseInt(url.port),
        uuid: uuid || '',
        password: password || '',
        sni: params.sni || '',
        alpn: params.alpn || 'h3',
        congestionController: params.congestion_control || 'bbr',
        isActive: true,
      };
    }
    
    // WireGuard: wg://server:port?params#name
    if (uri.startsWith('wireguard://') || uri.startsWith('wg://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'WireGuard Node',
        type: 'wireguard',
        server: url.hostname,
        port: parseInt(url.port),
        privateKey: params.privatekey || '',
        publicKey: params.publickey || '',
        presharedKey: params.presharedkey || '',
        allowedIPs: (params.allowedips || '0.0.0.0/0').split(','),
        mtu: parseInt(params.mtu) || 1420,
        isActive: true,
      };
    }
    
    // Snell: snell://server:port?params#name
    if (uri.startsWith('snell://')) {
      const url = new URL(uri);
      const params = Object.fromEntries(url.searchParams);
      return {
        name: decodeURIComponent(url.hash.slice(1)) || 'Snell Node',
        type: 'snell',
        server: url.hostname,
        port: parseInt(url.port),
        password: params.psk || '',
        snellVersion: parseInt(params.version) || 3,
        isActive: true,
      };
    }
  } catch (e) {
    console.error('Parse node error:', e.message, uri.slice(0, 50));
  }
  
  return null;
}

// ============ 解析订阅内容 ============
function parseSubscriptionContent(content, headers = {}) {
  const nodes = [];
  let contentType = headers['content-type'] || '';
  
  // 尝试 base64 解码
  let decoded = decodeBase64Safe(content);
  
  // 如果解码后包含协议前缀，说明是 base64 编码的订阅
  if (decoded && /(vmess|vless|trojan|ss|ssr|hysteria|tuic|wireguard|snell):\/\//i.test(decoded)) {
    content = decoded;
  }
  
  // 按行分割
  const lines = content.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const node = parseNodeUri(line);
    if (node) {
      nodes.push(node);
    }
  }
  
  return nodes;
}

// ============ 解析订阅 URL ============
router.post('/parse', authAdmin, async (req, res) => {
  try {
    const { url, subscriptionId } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: '请提供订阅 URL' });
    }
    
    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: '无效的 URL 格式' });
    }
    
    console.log(`[Subscription] Parsing URL: ${url}`);
    
    // 获取订阅内容
    const response = await fetchUrl(url);
    const content = response.data.toString('utf-8');
    
    if (!content || content.length < 10) {
      return res.status(400).json({ success: false, message: '订阅内容为空或格式错误' });
    }
    
    // 解析节点
    const nodes = parseSubscriptionContent(content, response.headers);
    
    if (nodes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '未能解析到任何节点，请检查订阅格式',
        preview: content.slice(0, 500),
      });
    }
    
    // 生成节点 ID
    const parsedNodes = nodes.map((node, i) => ({
      ...node,
      id: `node_${Date.now()}_${i}_${crypto.randomBytes(4).toString('hex')}`,
      subscriptionId: subscriptionId || 'manual',
      latency: null,
      online: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    
    // 如果提供了 subscriptionId，保存到数据库
    if (subscriptionId) {
      // 删除旧节点
      await query('DELETE FROM nodes WHERE subscription_id = ?', [subscriptionId]);
      
      // 插入新节点
      for (const node of parsedNodes) {
        await query(
          `INSERT INTO nodes (id, subscription_id, name, type, server, port, uuid, password, 
           cipher, network, tls, host, path, sni, country_code, country, group_name, 
           alter_id, flow, alpn, congestion_controller, public_key, private_key, 
           preshared_key, allowed_ips, mtu, snell_version, obfs_mode, obfs_param, 
           protocol, protocol_param, recv_window, auth, is_active, online, latency, 
           custom_name, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [node.id, node.subscriptionId, node.name, node.type, node.server, node.port,
           node.uuid || null, node.password || null, node.cipher || null, node.network || null,
           node.tls || false, node.host || null, node.path || null, node.sni || null,
           node.countryCode || 'XX', node.country || 'Unknown', node.group || 'Default',
           node.alterId || 0, node.flow || null, node.alpn || null,
           node.congestionController || null, node.publicKey || null, node.privateKey || null,
           node.presharedKey || null, node.allowedIPs ? JSON.stringify(node.allowedIPs) : null,
           node.mtu || 1420, node.snellVersion || 3, node.obfsMode || null,
           node.obfsParam || null, node.protocol || null, node.protocolParam || null,
           node.recvWindow || null, node.auth || null,
           node.isActive !== false, node.online !== false, node.latency,
           node.customName || null],
        );
      }
    }
    
    res.json({
      success: true,
      message: `成功解析 ${parsedNodes.length} 个节点`,
      count: parsedNodes.length,
      nodes: parsedNodes,
      preview: content.slice(0, 200),
    });
  } catch (error) {
    console.error('[Subscription] Parse error:', error);
    res.status(500).json({
      success: false,
      message: `解析失败: ${error.message}`,
    });
  }
});

// ============ 获取订阅链接（用户端） ============
router.get('/:token', optionalAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const { target = 'Clash.Meta' } = req.query;
    
    // 查找用户
    const user = await queryOne('SELECT * FROM users WHERE subscription_token = ?', [token]);
    if (!user) {
      return res.status(404).json({ success: false, message: '无效的订阅令牌' });
    }
    
    // 检查套餐是否过期
    if (user.plan_expire_at && new Date(user.plan_expire_at) < new Date()) {
      return res.status(403).json({ success: false, message: '套餐已过期' });
    }
    
    // 获取用户套餐的节点
    const nodes = await query(
      `SELECT n.* FROM nodes n
       INNER JOIN plan_nodes pn ON n.id = pn.node_id
       INNER JOIN subscriptions s ON n.subscription_id = s.id
       WHERE s.id IN (
         SELECT subscription_id FROM plan_node_groups 
         WHERE plan_id = (SELECT plan_id FROM user_plans WHERE user_id = ? AND status = 'active' LIMIT 1)
       ) AND n.is_active = 1
       ORDER BY n.country_code, n.name`,
      [user.id],
    );
    
    if (nodes.length === 0) {
      return res.status(404).json({ success: false, message: '暂无可用节点' });
    }
    
    // 更新订阅时间
    await query('UPDATE users SET last_sub_update = NOW() WHERE id = ?', [user.id]);
    
    // 设置订阅响应头
    res.set({
      'Content-Type': target === 'Clash.Meta' || target === 'Clash' ? 'text/yaml' : 'text/plain',
      'Subscription-Userinfo': `upload=${user.upload || 0}; download=${user.download || 0}; total=${user.plan_total || 0}; expire=${user.plan_expire_at ? Math.floor(new Date(user.plan_expire_at).getTime() / 1000) : 0}`,
      'Profile-Update-Interval': '24',
    });
    
    // 生成配置（这里简化处理，实际应该调用 subscription.ts 的逻辑）
    const config = generateConfig(nodes, target, user.username);
    res.send(config);
  } catch (error) {
    console.error('[Subscription] Get error:', error);
    res.status(500).json({ success: false, message: '获取订阅失败' });
  }
});

// ============ 配置生成器 ============
function generateConfig(nodes, target, username) {
  switch (target) {
    case 'Clash.Meta':
    case 'Clash':
      return generateClashConfig(nodes, username);
    case 'sing-box':
      return generateSingBoxConfig(nodes);
    case 'V2Ray':
      return generateV2RayConfig(nodes);
    default:
      return generateClashConfig(nodes, username);
  }
}

function generateClashConfig(nodes, username) {
  const proxies = nodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `  - name: "${node.name}"
    type: vmess
    server: ${node.server}
    port: ${node.port}
    uuid: ${node.uuid || ''}
    alterId: ${node.alterId || 0}
    cipher: ${node.cipher || 'auto'}
    udp: true
    network: ${node.network || 'ws'}
    tls: ${node.tls || false}
    servername: ${node.sni || node.server}
    ws-opts:
      path: "${node.path || '/'}"
      headers:
        Host: ${node.host || node.server}`;
      case 'trojan':
        return `  - name: "${node.name}"
    type: trojan
    server: ${node.server}
    port: ${node.port}
    password: ${node.password || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true`;
      case 'ss':
        return `  - name: "${node.name}"
    type: ss
    server: ${node.server}
    port: ${node.port}
    cipher: ${node.cipher || 'aes-256-gcm'}
    password: ${node.password || ''}
    udp: true`;
      default:
        return null;
    }
  }).filter(Boolean).join('\n');
  
  const proxyNames = nodes.map(n => `      - "${n.name}"`).join('\n');
  
  return `# Clash Meta Configuration
# User: ${username}
# Generated: ${new Date().toISOString()}

mixed-port: 7890
allow-lan: true
mode: rule
log-level: info

dns:
  enable: true
  listen: 0.0.0.0:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - https://223.5.5.5/dns-query
    - https://dns.alidns.com/dns-query

proxies:
${proxies}

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "♻️ 自动选择"
${proxyNames}
  - name: "♻️ 自动选择"
    type: url-test
    proxies:
${proxyNames}
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

rules:
  - GEOIP,CN,DIRECT
  - MATCH,🚀 节点选择`;
}

function generateSingBoxConfig(nodes) {
  const outbounds = nodes.map(node => {
    const base = { tag: node.name, type: '' };
    switch (node.type) {
      case 'vmess':
        base.type = 'vmess';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        break;
      case 'trojan':
        base.type = 'trojan';
        base.server = node.server;
        base.server_port = node.port;
        base.password = node.password || '';
        break;
      case 'ss':
        base.type = 'shadowsocks';
        base.server = node.server;
        base.server_port = node.port;
        base.method = node.cipher || 'aes-256-gcm';
        base.password = node.password || '';
        break;
      default:
        return null;
    }
    return base;
  }).filter(Boolean);
  
  return JSON.stringify({
    log: { level: 'info' },
    dns: {
      servers: [
        { tag: 'dns_proxy', address: 'tls://8.8.8.8' },
        { tag: 'dns_direct', address: '223.5.5.5' },
      ],
    },
    inbounds: [{ type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true }],
    outbounds: [
      ...outbounds,
      { type: 'selector', tag: '🚀 节点选择', outbounds: outbounds.map(o => o.tag) },
      { type: 'direct', tag: 'DIRECT' },
    ],
    route: { rules: [{ protocol: 'dns', outbound: 'DIRECT' }], final: '🚀 节点选择' },
  }, null, 2);
}

function generateV2RayConfig(nodes) {
  const links = nodes.map(node => {
    switch (node.type) {
      case 'vmess':
        const obj = { v: '2', ps: node.name, add: node.server, port: String(node.port), id: node.uuid || '', aid: String(node.alterId || 0), net: node.network || 'tcp', tls: node.tls ? 'tls' : '' };
        return `vmess://${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
      case 'trojan':
        return `trojan://${node.password || ''}@${node.server}:${node.port}#${encodeURIComponent(node.name)}`;
      case 'ss':
        const auth = Buffer.from(`${node.cipher || 'aes-256-gcm'}:${node.password || ''}`).toString('base64');
        return `ss://${auth}@${node.server}:${node.port}#${encodeURIComponent(node.name)}`;
      default:
        return '';
    }
  }).filter(Boolean).join('\n');
  
  return Buffer.from(links).toString('base64');
}

// ============ 节点延迟测试（后端真实检测） ============
router.post('/test-latency', authAdmin, async (req, res) => {
  try {
    const { nodeId, server, port } = req.body;
    
    if (!server || !port) {
      return res.status(400).json({ success: false, message: '请提供服务器地址和端口' });
    }
    
    const startTime = Date.now();
    
    // TCP 连接测试
    const result = await new Promise((resolve) => {
      const socket = require('net').createConnection({
        host: server,
        port: parseInt(port),
        timeout: 5000,
      }, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ success: true, latency, online: true });
      });
      
      socket.on('error', () => {
        const latency = Date.now() - startTime;
        resolve({ success: false, latency, online: false });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, latency: 5000, online: false });
      });
    });
    
    // 更新数据库
    if (nodeId) {
      await query(
        'UPDATE nodes SET latency = ?, online = ?, last_check = NOW() WHERE id = ?',
        [result.success ? result.latency : null, result.online, nodeId],
      );
    }
    
    res.json({
      success: true,
      ...result,
      server,
      port,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `延迟测试失败: ${error.message}` });
  }
});

// ============ 批量延迟测试 ============
router.post('/batch-latency', authAdmin, async (req, res) => {
  try {
    const { nodes } = req.body;
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ success: false, message: '请提供节点列表' });
    }
    
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (node) => {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
          const socket = require('net').createConnection({
            host: node.server,
            port: parseInt(node.port),
            timeout: 5000,
          }, () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve({ id: node.id, success: true, latency, online: true });
          });
          
          socket.on('error', () => {
            const latency = Date.now() - startTime;
            resolve({ id: node.id, success: false, latency, online: false });
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            resolve({ id: node.id, success: false, latency: 5000, online: false });
          });
        });
      }));
      
      results.push(...batchResults);
      
      // 更新数据库
      for (const result of batchResults) {
        await query(
          'UPDATE nodes SET latency = ?, online = ?, last_check = NOW() WHERE id = ?',
          [result.success ? result.latency : null, result.online, result.id],
        );
      }
    }
    
    res.json({
      success: true,
      message: `完成 ${results.length} 个节点测试`,
      results,
      online: results.filter(r => r.online).length,
      offline: results.filter(r => !r.online).length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `批量测试失败: ${error.message}` });
  }
});

module.exports = router;
