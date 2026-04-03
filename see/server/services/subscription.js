// 订阅生成服务
const { get, query } = require('../config/database');

/**
 * 生成订阅链接
 */
function generateSubscriptionLink(token) {
  const baseUrl = process.env.SUBSCRIPTION_URL || 'http://localhost:3000';
  return `${baseUrl}/api/subscribe/${token}`;
}

/**
 * 生成SS链接
 */
function generateSSLink(node) {
  const userInfo = Buffer.from(`${node.cipher}:${node.password}`).toString('base64');
  return `ss://${userInfo}@${node.server}:${node.port}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成SSR链接
 */
function generateSSRLink(node) {
  const config = {
    server: node.server,
    port: node.port,
    protocol: node.protocol || 'origin',
    method: node.cipher || 'aes-256-cfb',
    obfs: node.obfsMode || 'plain',
    password: Buffer.from(node.password).toString('base64'),
    obfsparam: Buffer.from(node.obfsParam || '').toString('base64'),
    protoparam: Buffer.from(node.protocolParam || '').toString('base64'),
    remarks: Buffer.from(node.customName || node.name).toString('base64')
  };
  const str = `${config.server}:${config.port}:${config.protocol}:${config.method}:${config.obfs}:${config.password}/?obfsparam=${config.obfsparam}&protoparam=${config.protoparam}&remarks=${config.remarks}`;
  return `ssr://${Buffer.from(str).toString('base64')}`;
}

/**
 * 生成VMess链接
 */
function generateVMessLink(node) {
  const config = {
    v: '2',
    ps: node.customName || node.name,
    add: node.server,
    port: node.port,
    id: node.uuid,
    aid: node.alterId || 0,
    net: node.network || 'tcp',
    type: node.type === 'vmess' ? 'none' : (node.obfs || 'none'),
    host: node.host || '',
    path: node.path || '',
    tls: node.tls ? 'tls' : '',
    sni: node.sni || ''
  };
  return `vmess://${Buffer.from(JSON.stringify(config)).toString('base64')}`;
}

/**
 * 生成VLESS链接
 */
function generateVLESSLink(node) {
  const params = new URLSearchParams();
  if (node.network) params.set('type', node.network);
  if (node.security) params.set('security', node.security);
  if (node.path) params.set('path', node.path);
  if (node.host) params.set('host', node.host);
  if (node.sni) params.set('sni', node.sni);
  if (node.flow) params.set('flow', node.flow);
  if (node.encryption) params.set('encryption', node.encryption);

  return `vless://${node.uuid}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成Trojan链接
 */
function generateTrojanLink(node) {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  if (node.network) params.set('type', node.network);
  if (node.path) params.set('path', node.path);
  if (node.host) params.set('host', node.host);

  return `trojan://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成Hysteria2链接
 */
function generateHysteria2Link(node) {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  if (node.alpn) params.set('alpn', node.alpn);
  params.set('insecure', node.tls ? '0' : '1');

  return `hysteria2://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成TUIC链接
 */
function generateTUICLink(node) {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  if (node.alpn) params.set('alpn', node.alpn);
  if (node.congestionController) params.set('congestion_control', node.congestionController);

  return `tuic://${node.uuid}:${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成WireGuard链接
 */
function generateWireGuardLink(node) {
  const params = new URLSearchParams();
  params.set('publickey', node.publicKey);
  if (node.presharedKey) params.set('presharedkey', node.presharedKey);
  if (node.allowedIPs) params.set('allowedips', node.allowedIPs.join(','));

  return `wg://${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 生成Snell链接
 */
function generateSnellLink(node) {
  const params = new URLSearchParams();
  params.set('version', node.snellVersion || '3');
  if (node.obfs) params.set('obfs', node.obfs);

  return `snell://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.customName || node.name)}`;
}

/**
 * 根据节点类型生成对应链接
 */
function generateNodeLink(node) {
  const generators = {
    ss: generateSSLink,
    ssr: generateSSRLink,
    vmess: generateVMessLink,
    vless: generateVLESSLink,
    trojan: generateTrojanLink,
    hysteria: generateHysteria2Link,
    hysteria2: generateHysteria2Link,
    tuic: generateTUICLink,
    wireguard: generateWireGuardLink,
    snell: generateSnellLink
  };

  const generator = generators[node.type];
  if (!generator) {
    console.warn(`不支持的节点类型: ${node.type}`);
    return null;
  }

  return generator(node);
}

/**
 * 生成Clash配置
 */
function generateClashConfig(nodes, subscriptionInfo) {
  const proxies = nodes.map(node => {
    const proxy = {
      name: node.customName || node.name,
      type: node.type,
      server: node.server,
      port: node.port,
      udp: true
    };

    switch (node.type) {
      case 'ss':
        proxy.cipher = node.cipher;
        proxy.password = node.password;
        break;
      case 'vmess':
        proxy.uuid = node.uuid;
        proxy.alterId = node.alterId || 0;
        proxy.cipher = node.cipher || 'auto';
        proxy.network = node.network || 'tcp';
        if (node.tls) {
          proxy.tls = true;
          proxy.servername = node.sni || node.host;
        }
        if (node.network === 'ws') {
          proxy['ws-opts'] = {
            path: node.path || '/',
            headers: { Host: node.host }
          };
        }
        break;
      case 'vless':
        proxy.uuid = node.uuid;
        proxy.network = node.network || 'tcp';
        proxy.tls = node.security === 'tls' || node.security === 'xtls';
        if (proxy.tls) {
          proxy.servername = node.sni;
        }
        if (node.flow) proxy.flow = node.flow;
        if (node.network === 'ws') {
          proxy['ws-opts'] = {
            path: node.path || '/',
            headers: { Host: node.host }
          };
        }
        break;
      case 'trojan':
        proxy.password = node.password;
        proxy.sni = node.sni;
        if (node.network === 'ws') {
          proxy.network = 'ws';
          proxy['ws-opts'] = {
            path: node.path || '/',
            headers: { Host: node.host }
          };
        }
        break;
      case 'hysteria2':
        proxy.password = node.password;
        proxy.sni = node.sni;
        break;
      case 'tuic':
        proxy.uuid = node.uuid;
        proxy.password = node.password;
        proxy.sni = node.sni;
        if (node.alpn) proxy.alpn = [node.alpn];
        if (node.congestionController) {
          proxy['congestion-controller'] = node.congestionController;
        }
        break;
      case 'wireguard':
        proxy['private-key'] = node.privateKey;
        proxy['public-key'] = node.publicKey;
        proxy['pre-shared-key'] = node.presharedKey;
        proxy['allowed-ips'] = node.allowedIPs || ['0.0.0.0/0'];
        break;
    }

    return proxy;
  }).filter(Boolean);

  const config = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    proxies,
    'proxy-groups': [
      {
        name: '🚀 节点选择',
        type: 'select',
        proxies: ['♻️ 自动选择', '🎯 全球直连', ...proxies.map(p => p.name)]
      },
      {
        name: '♻️ 自动选择',
        type: 'url-test',
        proxies: proxies.map(p => p.name),
        url: 'http://www.gstatic.com/generate_204',
        interval: 300
      },
      {
        name: '🐟 漏网之鱼',
        type: 'select',
        proxies: ['🚀 节点选择', '🎯 全球直连']
      },
      {
        name: '🎯 全球直连',
        type: 'select',
        proxies: ['DIRECT']
      },
      {
        name: '📲 电报消息',
        type: 'select',
        proxies: ['🚀 节点选择', '♻️ 自动选择', '🎯 全球直连']
      },
      {
        name: '🎬 油管视频',
        type: 'select',
        proxies: ['🚀 节点选择', '♻️ 自动选择']
      },
      {
        name: '📺 巴哈姆特',
        type: 'select',
        proxies: ['🚀 节点选择', '♻️ 自动选择']
      },
      {
        name: '🌍 国外媒体',
        type: 'select',
        proxies: ['🚀 节点选择', '♻️ 自动选择', '🎯 全球直连']
      },
      {
        name: '🌏 国内媒体',
        type: 'select',
        proxies: ['🎯 全球直连', '🚀 节点选择']
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT',
      'IP-CIDR,192.168.0.0/16,DIRECT',
      'IP-CIDR,10.0.0.0/8,DIRECT',
      'IP-CIDR,172.16.0.0/12,DIRECT',
      'IP-CIDR,100.64.0.0/10,DIRECT',
      'DOMAIN-SUFFIX,cn,DIRECT',
      'GEOIP,CN,DIRECT',
      'MATCH,🐟 漏网之鱼'
    ]
  };

  return config;
}

/**
 * 生成Surge配置
 */
function generateSurgeConfig(nodes) {
  let config = '[General]\n';
  config += 'skip-proxy = 127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,100.64.0.0/10,localhost,*.local\n';
  config += 'dns-server = 119.29.29.29,223.5.5.5\n';
  config += '\n[Proxy]\n';

  nodes.forEach(node => {
    const name = node.customName || node.name;
    switch (node.type) {
      case 'ss':
        config += `${name} = ss, ${node.server}, ${node.port}, encrypt-method=${node.cipher}, password=${node.password}\n`;
        break;
      case 'vmess':
        config += `${name} = vmess, ${node.server}, ${node.port}, username=${node.uuid}`;
        if (node.tls) config += ', tls=true';
        if (node.network === 'ws') {
          config += ', ws=true, ws-path=' + (node.path || '/');
          if (node.host) config += ', ws-headers=Host:' + node.host;
        }
        config += '\n';
        break;
      case 'trojan':
        config += `${name} = trojan, ${node.server}, ${node.port}, password=${node.password}`;
        if (node.sni) config += ', sni=' + node.sni;
        config += '\n';
        break;
    }
  });

  config += '\n[Proxy Group]\n';
  config += 'Proxy = select, AUTO, ' + nodes.map(n => n.customName || n.name).join(', ') + '\n';
  config += '\n[Rule]\n';
  config += 'FINAL,Proxy\n';

  return config;
}

/**
 * 生成Sing-box配置
 */
function generateSingboxConfig(nodes) {
  const outbounds = nodes.map(node => {
    const outbound = {
      tag: node.customName || node.name,
      type: node.type
    };

    switch (node.type) {
      case 'ss':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.method = node.cipher;
        outbound.password = node.password;
        break;
      case 'vmess':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        outbound.security = node.cipher || 'auto';
        outbound.transport = {};
        if (node.network === 'ws') {
          outbound.transport.type = 'ws';
          outbound.transport.path = node.path || '/';
          outbound.transport.headers = { Host: node.host };
        }
        if (node.tls) {
          outbound.tls = {
            enabled: true,
            server_name: node.sni || node.host
          };
        }
        break;
      case 'vless':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        break;
      case 'trojan':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.password = node.password;
        if (node.sni) {
          outbound.tls = {
            enabled: true,
            server_name: node.sni
          };
        }
        break;
      case 'hysteria2':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.password = node.password;
        if (node.sni) {
          outbound.tls = {
            enabled: true,
            server_name: node.sni
          };
        }
        break;
      case 'tuic':
        outbound.server = node.server;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        outbound.password = node.password;
        break;
    }

    return outbound;
  });

  return {
    log: { level: 'info', timestamp: true },
    dns: {
      servers: [
        { tag: 'dns_proxy', address: 'tls://8.8.8.8' },
        { tag: 'dns_local', address: '223.5.5.5', detour: 'direct' }
      ],
      rules: [
        { outbound: 'any', server: 'dns_local' },
        { geosite: 'cn', server: 'dns_local' }
      ]
    },
    inbounds: [
      { type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true }
    ],
    outbounds: [
      ...outbounds,
      { type: 'selector', tag: 'proxy', outbounds: outbounds.map(o => o.tag) },
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' }
    ],
    route: {
      rules: [
        { ip_is_private: true, outbound: 'direct' },
        { geosite: 'cn', outbound: 'direct' },
        { geoip: 'cn', outbound: 'direct' },
        { outbound: 'proxy' }
      ]
    }
  };
}

/**
 * 获取订阅信息（HTTP端点）
 */
async function getSubscription(token) {
  try {
    const user = await get(`
      SELECT u.*, p.name as plan_name, p.duration, p.data_limit, p.speed_limit
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.subscription_token = ?
    `, [token]);

    if (!user) {
      return { success: false, message: '无效的订阅token' };
    }

    // 获取用户可用节点
    const nodes = await query(`
      SELECT n.* FROM nodes n
      JOIN plan_nodes pn ON n.id = pn.node_id
      WHERE pn.plan_id = ? AND n.is_active = 1
      ORDER BY pn.priority DESC
    `, [user.plan_id || '']);

    // 生成各种格式的订阅
    const ssLinks = [];
    const vmessLinks = [];
    const allLinks = [];

    nodes.forEach(node => {
      const link = generateNodeLink(node);
      if (link) {
        allLinks.push(link);
        if (node.type === 'ss' || node.type === 'ssr') {
          ssLinks.push(link);
        } else if (node.type === 'vmess') {
          vmessLinks.push(link);
        }
      }
    });

    return {
      success: true,
      data: {
        userInfo: {
          username: user.username,
          planName: user.plan_name,
          planExpire: user.plan_expire,
          dataUsed: user.data_used,
          dataLimit: user.data_limit
        },
        nodes,
        formats: {
          base64: Buffer.from(allLinks.join('\n')).toString('base64'),
          clash: generateClashConfig(nodes, {
            upload: user.data_used,
            download: user.data_used,
            total: user.data_limit * 1024 * 1024 * 1024,
            expire: user.plan_expire ? new Date(user.plan_expire).getTime() : 0
          }),
          surge: generateSurgeConfig(nodes),
          singbox: generateSingboxConfig(nodes),
          links: allLinks
        }
      }
    };
  } catch (error) {
    console.error('获取订阅失败:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  generateSubscriptionLink,
  generateNodeLink,
  generateClashConfig,
  generateSurgeConfig,
  generateSingboxConfig,
  getSubscription
};
