const https = require('https');
const http = require('http');
const { URL } = require('url');
const net = require('net');

class SubscriptionParser {
  constructor() {
    this.protocols = ['vmess', 'vless', 'trojan', 'ss', 'ssr', 'hysteria', 'hysteria2', 'tuic', 'snell', 'socks', 'http', 'wireguard'];
  }

  // 获取订阅内容
  async fetchSubscription(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'ClashMeta/2023.12.0',
          'Accept': '*/*',
        },
        timeout: 15000,
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        // 处理重定向
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchSubscription(res.headers.location).then(resolve).catch(reject);
        }
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('订阅获取超时'));
      });
      
      req.end();
    });
  }

  // 解码Base64
  decodeBase64(str) {
    try {
      // 清理base64字符串
      let cleaned = str.replace(/\s/g, '');
      // 添加填充
      const pad = cleaned.length % 4;
      if (pad) {
        cleaned += '='.repeat(4 - pad);
      }
      return Buffer.from(cleaned, 'base64').toString('utf8');
    } catch (e) {
      return str;
    }
  }

  // 解析订阅
  async parse(url) {
    try {
      const response = await this.fetchSubscription(url);
      let content = response.data;
      
      // 尝试base64解码
      let decoded = this.decodeBase64(content);
      
      // 如果解码后包含协议前缀，说明解码成功
      const hasProtocol = this.protocols.some(p => decoded.toLowerCase().includes(p + '://'));
      
      if (!hasProtocol) {
        // 尝试再次解码（可能双重编码）
        const doubleDecoded = this.decodeBase64(decoded);
        const doubleHasProtocol = this.protocols.some(p => doubleDecoded.toLowerCase().includes(p + '://'));
        if (doubleHasProtocol) {
          decoded = doubleDecoded;
        }
      }

      // 解析节点
      const nodes = this.parseNodes(decoded);
      
      // 获取订阅信息
      const subscriptionInfo = this.parseSubscriptionInfo(response.headers);
      
      return {
        success: true,
        nodes: nodes,
        subscriptionInfo: subscriptionInfo,
        rawCount: nodes.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        nodes: [],
        subscriptionInfo: null
      };
    }
  }

  // 解析订阅头信息
  parseSubscriptionInfo(headers) {
    const info = {};
    
    if (headers['subscription-userinfo']) {
      const userinfo = headers['subscription-userinfo'];
      const matches = userinfo.match(/upload=(\d+).*download=(\d+).*total=(\d+).*expire=(\d+)/);
      if (matches) {
        info.upload = parseInt(matches[1]);
        info.download = parseInt(matches[2]);
        info.total = parseInt(matches[3]);
        info.expire = parseInt(matches[4]);
        info.used = info.upload + info.download;
        info.percent = Math.round((info.used / info.total) * 100);
      }
    }
    
    if (headers['profile-update-interval']) {
      info.updateInterval = parseInt(headers['profile-update-interval']);
    }
    
    if (headers['profile-web-page-url']) {
      info.webPageUrl = headers['profile-web-page-url'];
    }
    
    return Object.keys(info).length > 0 ? info : null;
  }

  // 解析节点
  parseNodes(content) {
    const nodes = [];
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      let node = null;
      
      if (trimmed.startsWith('vmess://')) {
        node = this.parseVmess(trimmed);
      } else if (trimmed.startsWith('vless://')) {
        node = this.parseVless(trimmed);
      } else if (trimmed.startsWith('trojan://')) {
        node = this.parseTrojan(trimmed);
      } else if (trimmed.startsWith('ss://')) {
        node = this.parseSS(trimmed);
      } else if (trimmed.startsWith('ssr://')) {
        node = this.parseSSR(trimmed);
      } else if (trimmed.startsWith('hysteria://')) {
        node = this.parseHysteria(trimmed);
      } else if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) {
        node = this.parseHysteria2(trimmed);
      } else if (trimmed.startsWith('tuic://')) {
        node = this.parseTUIC(trimmed);
      } else if (trimmed.startsWith('snell://')) {
        node = this.parseSnell(trimmed);
      } else if (trimmed.startsWith('socks://') || trimmed.startsWith('http://')) {
        node = this.parseSocksHttp(trimmed);
      }
      
      if (node) {
        nodes.push(node);
      }
    }
    
    return nodes;
  }

  // 解析VMess
  parseVmess(url) {
    try {
      const base64 = url.substring(8);
      const decoded = this.decodeBase64(base64);
      const config = JSON.parse(decoded);
      
      return {
        name: config.ps || config.remarks || `${config.add}:${config.port}`,
        server: config.add,
        port: parseInt(config.port),
        protocol: 'vmess',
        uuid: config.id,
        alterId: parseInt(config.aid) || 0,
        network: config.net || 'tcp',
        tls: config.tls === 'tls',
        sni: config.sni || config.add,
        wsPath: config.path || '/',
        wsHeaders: config.headers || {},
        country: this.detectCountry(config.ps || ''),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析VLESS
  parseVless(url) {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 443,
        protocol: 'vless',
        uuid: parsed.username,
        flow: params.get('flow') || '',
        network: params.get('type') || 'tcp',
        tls: params.get('security') === 'tls' || params.get('security') === 'reality',
        sni: params.get('sni') || parsed.hostname,
        wsPath: params.get('path') || '/',
        reality: params.get('security') === 'reality',
        realityPublicKey: params.get('pbk') || '',
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Trojan
  parseTrojan(url) {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 443,
        protocol: 'trojan',
        password: parsed.username,
        network: params.get('type') || 'tcp',
        tls: true,
        sni: params.get('sni') || parsed.hostname,
        wsPath: params.get('path') || '/',
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Shadowsocks
  parseSS(url) {
    try {
      const withoutProtocol = url.substring(5);
      let config = {};
      
      // 尝试 SIP002 格式
      if (withoutProtocol.includes('@')) {
        const [userInfo, serverInfo] = withoutProtocol.split('@');
        const [hostname, ...rest] = serverInfo.split(':');
        const port = rest.join(':').split('/')[0].split('#')[0];
        
        // 解码用户信息
        let decodedUser;
        try {
          decodedUser = this.decodeBase64(userInfo);
        } catch {
          decodedUser = userInfo;
        }
        
        const [method, ...passwordParts] = decodedUser.split(':');
        const password = passwordParts.join(':');
        
        const hashIndex = withoutProtocol.indexOf('#');
        const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.substring(hashIndex + 1)) : `${hostname}:${port}`;
        
        config = {
          name: name,
          server: hostname,
          port: parseInt(port),
          protocol: 'ss',
          cipher: method,
          password: password,
          country: this.detectCountry(name),
          group: '默认',
          enabled: true,
          status: 'unknown'
        };
      } else {
        // 传统格式
        const decoded = this.decodeBase64(withoutProtocol.split('#')[0]);
        const [method, password, serverInfo] = decoded.split(':');
        const [server, port] = serverInfo.split('@').reverse();
        
        const hashIndex = withoutProtocol.indexOf('#');
        const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.substring(hashIndex + 1)) : `${server}:${port}`;
        
        config = {
          name: name,
          server: server,
          port: parseInt(port),
          protocol: 'ss',
          cipher: method,
          password: password,
          country: this.detectCountry(name),
          group: '默认',
          enabled: true,
          status: 'unknown'
        };
      }
      
      return config;
    } catch (e) {
      return null;
    }
  }

  // 解析SSR
  parseSSR(url) {
    try {
      const base64 = url.substring(6);
      const decoded = this.decodeBase64(base64.split('#')[0]);
      const parts = decoded.split('/?');
      const [server, port, protocol, cipher, obfs, password] = parts[0].split(':');
      
      const params = new URLSearchParams(parts[1] || '');
      const name = params.get('remarks') ? decodeURIComponent(this.decodeBase64(params.get('remarks'))) : `${server}:${port}`;
      
      return {
        name: name,
        server: server,
        port: parseInt(port),
        protocol: 'ssr',
        cipher: cipher,
        password: this.decodeBase64(password),
        obfs: obfs,
        protocolParam: params.get('protoparam') ? this.decodeBase64(params.get('protoparam')) : '',
        obfsParam: params.get('obfsparam') ? this.decodeBase64(params.get('obfsparam')) : '',
        country: this.detectCountry(name),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Hysteria
  parseHysteria(url) {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 443,
        protocol: 'hysteria',
        auth: parsed.username,
        sni: params.get('peer') || parsed.hostname,
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Hysteria2
  parseHysteria2(url) {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 443,
        protocol: 'hysteria2',
        password: parsed.username,
        sni: params.get('sni') || parsed.hostname,
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析TUIC
  parseTUIC(url) {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 443,
        protocol: 'tuic',
        uuid: parsed.username,
        password: parsed.password || '',
        sni: params.get('sni') || parsed.hostname,
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Snell
  parseSnell(url) {
    try {
      const withoutProtocol = url.substring(7);
      const [config, ...nameParts] = withoutProtocol.split('#');
      const [serverInfo, ...params] = config.split('?');
      const [server, port] = serverInfo.split(':');
      
      return {
        name: nameParts.length > 0 ? decodeURIComponent(nameParts.join('#')) : `${server}:${port}`,
        server: server,
        port: parseInt(port) || 443,
        protocol: 'snell',
        psk: new URLSearchParams(params.join('?')).get('psk') || '',
        country: this.detectCountry(nameParts.join('#')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 解析Socks/HTTP
  parseSocksHttp(url) {
    try {
      const parsed = new URL(url);
      const isSocks = url.startsWith('socks://');
      
      return {
        name: parsed.hash ? decodeURIComponent(parsed.hash.substring(1)) : `${parsed.hostname}:${parsed.port}`,
        server: parsed.hostname,
        port: parseInt(parsed.port) || 1080,
        protocol: isSocks ? 'socks' : 'http',
        username: parsed.username || '',
        password: parsed.password || '',
        country: this.detectCountry(decodeURIComponent(parsed.hash || '')),
        group: '默认',
        enabled: true,
        status: 'unknown'
      };
    } catch (e) {
      return null;
    }
  }

  // 检测国家
  detectCountry(name) {
    const countryMap = {
      '🇺🇸': 'US', '🇨🇳': 'CN', '🇯🇵': 'JP', '🇬🇧': 'GB', '🇩🇪': 'DE',
      '🇫🇷': 'FR', '🇨🇦': 'CA', '🇦🇺': 'AU', '🇸🇬': 'SG', '🇭🇰': 'HK',
      '🇰🇷': 'KR', '🇹🇼': 'TW', '🇷🇺': 'RU', '🇮🇳': 'IN', '🇧🇷': 'BR',
      '🇳🇱': 'NL', '🇮🇹': 'IT', '🇪🇸': 'ES', '🇸🇪': 'SE', '🇨🇭': 'CH',
      '🇦🇹': 'AT', '🇧🇪': 'BE', '🇵🇱': 'PL', '🇹🇷': 'TR', '🇦🇪': 'AE',
      '🇿🇦': 'ZA', '🇲🇽': 'MX', '🇦🇷': 'AR', '🇨🇱': 'CL', '🇵🇭': 'PH',
      '🇹🇭': 'TH', '🇻🇳': 'VN', '🇮🇩': 'ID', '🇲🇾': 'MY', '🇳🇿': 'NZ',
      '🇫🇮': 'FI', '🇩🇰': 'DK', '🇳🇴': 'NO', '🇮🇪': 'IE', '🇵🇹': 'PT',
      '🇨🇿': 'CZ', '🇭🇺': 'HU', '🇷🇴': 'RO', '🇧🇬': 'BG', '🇭🇷': 'HR',
      '🇬🇷': 'GR', '🇮🇱': 'IL', '🇪🇬': 'EG', '🇰🇪': 'KE', '🇳🇬': 'NG',
    };
    
    for (const [emoji, code] of Object.entries(countryMap)) {
      if (name.includes(emoji)) {
        return code;
      }
    }
    
    // 尝试英文国家名
    const englishMap = {
      'US': 'US', 'USA': 'US', 'America': 'US', 'United States': 'US',
      'China': 'CN', 'Hong Kong': 'HK', 'Taiwan': 'TW',
      'Japan': 'JP', 'Tokyo': 'JP', 'Osaka': 'JP',
      'UK': 'GB', 'London': 'GB', 'Britain': 'GB',
      'Germany': 'DE', 'Frankfurt': 'DE', 'Berlin': 'DE',
      'France': 'FR', 'Paris': 'FR',
      'Canada': 'CA', 'Toronto': 'CA', 'Vancouver': 'CA',
      'Australia': 'AU', 'Sydney': 'AU', 'Melbourne': 'AU',
      'Singapore': 'SG',
      'Korea': 'KR', 'Seoul': 'KR',
      'Russia': 'RU', 'Moscow': 'RU',
      'India': 'IN', 'Mumbai': 'IN',
      'Brazil': 'BR', 'Sao Paulo': 'BR',
      'Netherlands': 'NL', 'Amsterdam': 'NL',
      'Italy': 'IT', 'Rome': 'IT', 'Milan': 'IT',
      'Spain': 'ES', 'Madrid': 'ES', 'Barcelona': 'ES',
      'Sweden': 'SE', 'Stockholm': 'SE',
      'Switzerland': 'CH', 'Zurich': 'CH',
      'Turkey': 'TR', 'Istanbul': 'TR',
      'UAE': 'AE', 'Dubai': 'AE',
      'Thailand': 'TH', 'Bangkok': 'TH',
      'Vietnam': 'VN', 'Hanoi': 'VN',
      'Philippines': 'PH', 'Manila': 'PH',
      'Malaysia': 'MY', 'Kuala Lumpur': 'MY',
      'New Zealand': 'NZ', 'Auckland': 'NZ',
    };
    
    for (const [keyword, code] of Object.entries(englishMap)) {
      if (name.toLowerCase().includes(keyword.toLowerCase())) {
        return code;
      }
    }
    
    return 'XX'; // 未知
  }

  // 测试节点延迟
  async testLatency(node, timeout = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ latency: -1, status: 'timeout' });
      }, timeout);
      
      socket.on('connect', () => {
        clearTimeout(timer);
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ latency, status: 'online' });
      });
      
      socket.on('error', (err) => {
        clearTimeout(timer);
        const latency = Date.now() - start;
        resolve({ latency: -1, status: 'offline', error: err.message });
      });
      
      socket.connect(node.port, node.server);
    });
  }

  // 批量测试延迟
  async testBatchLatency(nodes, concurrency = 10, timeout = 5000) {
    const results = [];
    const queue = [...nodes];
    const running = new Set();
    
    const runNext = async () => {
      if (queue.length === 0) return;
      const node = queue.shift();
      running.add(node);
      
      try {
        const result = await this.testLatency(node, timeout);
        results.push({ ...node, ...result });
      } catch (error) {
        results.push({ ...node, latency: -1, status: 'error' });
      }
      
      running.delete(node);
      if (queue.length > 0) {
        await runNext();
      }
    };
    
    // 启动并发
    const workers = [];
    for (let i = 0; i < Math.min(concurrency, nodes.length); i++) {
      workers.push(runNext());
    }
    
    await Promise.all(workers);
    return results;
  }
}

module.exports = new SubscriptionParser();
