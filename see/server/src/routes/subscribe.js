/**
 * 订阅路由 - 用户订阅链接输出
 */
const express = require('express');
const db = require('../config/database');

const router = express.Router();

// ============ 获取用户订阅内容 ============
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // 查找用户
    const users = await db.query(
      'SELECT u.*, p.name as plan_name, p.data_limit_gb, p.duration_days FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.subscription_token = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '订阅链接无效' });
    }

    const user = users[0];

    // 检查账户状态
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账户已暂停' });
    }

    // 检查是否过期
    if (user.plan_expire_at && new Date(user.plan_expire_at) < new Date()) {
      return res.status(403).json({ error: '套餐已过期' });
    }

    // 检查是否有套餐
    if (!user.plan_id) {
      return res.status(404).json({ error: '未订阅任何套餐' });
    }

    // 获取用户可用的节点
    const nodes = await db.query(
      `SELECT n.*, pn.custom_name, pn.priority 
       FROM nodes n 
       INNER JOIN plan_nodes pn ON n.id = pn.node_id 
       WHERE pn.plan_id = ? AND n.is_active = 1 
       ORDER BY pn.priority ASC`,
      [user.plan_id]
    );

    // 根据 Accept 头返回不同格式
    const accept = req.headers['accept'] || '';
    const target = req.query.target || '';

    if (accept.includes('yaml') || target === 'clash' || target === 'clash.meta') {
      // 返回 Clash 配置
      res.set({
        'Content-Type': 'text/yaml; charset=utf-8',
        'Content-Disposition': 'attachment; filename=clash.yaml',
        'Subscription-Userinfo': `upload=0; download=0; total=${user.data_limit_gb * 1024 * 1024 * 1024}; expire=${new Date(user.plan_expire_at).getTime() / 1000}`,
      });
      res.send(generateClashConfig(nodes, user.plan_name));
    } else if (target === 'sing-box') {
      res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Subscription-Userinfo': `upload=0; download=0; total=${user.data_limit_gb * 1024 * 1024 * 1024}; expire=${new Date(user.plan_expire_at).getTime() / 1000}`,
      });
      res.send(generateSingBoxConfig(nodes));
    } else {
      // 默认返回 Base64 编码的 URI 列表 (V2Ray/Shadowrocket 兼容)
      const uris = nodes.map(node => generateNodeUri(node)).filter(Boolean);
      const base64Content = Buffer.from(uris.join('\n')).toString('base64');

      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Subscription-Userinfo': `upload=0; download=0; total=${user.data_limit_gb * 1024 * 1024 * 1024}; expire=${new Date(user.plan_expire_at).getTime() / 1000}`,
      });
      res.send(base64Content);
    }
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ URI 生成函数 ============

function base64Encode(str) {
  try {
    return Buffer.from(str).toString('base64');
  } catch {
    return Buffer.from(str, 'utf8').toString('base64');
  }
}

function generateNodeUri(node) {
  const name = node.custom_name || node.name;
  const encodedName = encodeURIComponent(name);

  switch (node.type) {
    case 'ss':
      return `ss://${base64Encode(`${node.cipher || 'aes-256-gcm'}:${node.password}`)}@${node.server}:${node.port}#${encodedName}`;
    
    case 'vmess': {
      const vmessObj = {
        v: '2',
        ps: name,
        add: node.server,
        port: String(node.port),
        id: node.uuid || '',
        aid: String(node.alter_id || 0),
        net: node.network || 'tcp',
        type: 'none',
        host: node.host || '',
        path: node.path || '',
        tls: node.tls ? 'tls' : '',
        sni: node.sni || '',
      };
      return `vmess://${base64Encode(JSON.stringify(vmessObj))}`;
    }
    
    case 'vless': {
      const params = new URLSearchParams();
      params.set('encryption', node.encryption || 'none');
      params.set('security', node.tls ? 'tls' : 'none');
      if (node.network) params.set('type', node.network);
      if (node.path) params.set('path', node.path);
      if (node.host) params.set('host', node.host);
      if (node.sni) params.set('sni', node.sni);
      if (node.flow) params.set('flow', node.flow);
      return `vless://${node.uuid}@${node.server}:${node.port}?${params.toString()}#${encodedName}`;
    }
    
    case 'trojan': {
      const params = new URLSearchParams();
      if (node.sni) params.set('sni', node.sni);
      if (node.network) params.set('type', node.network);
      if (node.path) params.set('path', node.path);
      params.set('allowInsecure', '1');
      return `trojan://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodedName}`;
    }
    
    case 'hysteria2': {
      const params = new URLSearchParams();
      if (node.sni) params.set('sni', node.sni);
      params.set('insecure', '1');
      return `hysteria2://${node.password}@${node.server}:${node.port}/?${params.toString()}#${encodedName}`;
    }
    
    case 'tuic': {
      const params = new URLSearchParams();
      if (node.sni) params.set('sni', node.sni);
      params.set('alpn', node.alpn || 'h3');
      params.set('congestion_control', node.congestion_controller || 'bbr');
      return `tuic://${node.uuid}:${node.password}@${node.server}:${node.port}?${params.toString()}#${encodedName}`;
    }
    
    default:
      return '';
  }
}

// ============ Clash 配置生成 ============
function generateClashConfig(nodes, subscriptionName) {
  const proxies = nodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `  - name: "${node.custom_name || node.name}"
    type: vmess
    server: ${node.server}
    port: ${node.port}
    uuid: ${node.uuid || ''}
    alterId: ${node.alter_id || 0}
    cipher: ${node.cipher || 'auto'}
    udp: true
    network: ${node.network || 'ws'}
    tls: ${node.tls ? 'true' : 'false'}
    servername: ${node.sni || node.server}
    ws-opts:
      path: "${node.path || '/'}"
      headers:
        Host: ${node.host || node.server}`;
      
      case 'ss':
        return `  - name: "${node.custom_name || node.name}"
    type: ss
    server: ${node.server}
    port: ${node.port}
    cipher: ${node.cipher || 'aes-256-gcm'}
    password: ${node.password || ''}
    udp: true`;
      
      case 'trojan':
        return `  - name: "${node.custom_name || node.name}"
    type: trojan
    server: ${node.server}
    port: ${node.port}
    password: ${node.password || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true`;
      
      case 'vless':
        return `  - name: "${node.custom_name || node.name}"
    type: vless
    server: ${node.server}
    port: ${node.port}
    uuid: ${node.uuid || ''}
    network: ${node.network || 'ws'}
    tls: ${node.tls ? 'true' : 'false'}
    udp: true
    flow: ${node.flow || ''}
    client-fingerprint: chrome
    ws-opts:
      path: "${node.path || '/'}"
      headers:
        Host: ${node.host || node.server}
    servername: ${node.sni || node.server}`;
      
      case 'hysteria2':
        return `  - name: "${node.custom_name || node.name}"
    type: hysteria2
    server: ${node.server}
    port: ${node.port}
    password: ${node.password || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true`;
      
      case 'tuic':
        return `  - name: "${node.custom_name || node.name}"
    type: tuic
    server: ${node.server}
    port: ${node.port}
    uuid: ${node.uuid || ''}
    password: ${node.password || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true
    alpn:
      - h3
    congestion-controller: ${node.congestion_controller || 'bbr'}`;
      
      default:
        return '';
    }
  }).filter(Boolean).join('\n');

  const proxyNames = nodes.map(n => `      - "${n.custom_name || n.name}"`).join('\n');

  return `# Clash.Meta (mihomo) 配置文件
# 订阅名称: ${subscriptionName || 'Subscription'}
# 生成时间: ${new Date().toISOString()}

mixed-port: 7890
allow-lan: true
mode: rule
log-level: info
ipv6: false

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
      - "🎯 故障转移"
${proxyNames}
  - name: "♻️ 自动选择"
    type: url-test
    proxies:
${proxyNames}
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
  - name: "🎯 故障转移"
    type: fallback
    proxies:
${proxyNames}
    url: http://www.gstatic.com/generate_204
    interval: 300

rules:
  - DOMAIN-SUFFIX,google.com,🚀 节点选择
  - DOMAIN-SUFFIX,youtube.com,🚀 节点选择
  - DOMAIN-SUFFIX,twitter.com,🚀 节点选择
  - GEOIP,CN,DIRECT
  - MATCH,🚀 节点选择
`;
}

// ============ Sing-box 配置生成 ============
function generateSingBoxConfig(nodes) {
  const outbounds = nodes.map(node => {
    const base = { tag: node.custom_name || node.name, type: '' };
    
    switch (node.type) {
      case 'vmess':
        base.type = 'vmess';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.security = node.cipher || 'auto';
        base.alter_id = node.alter_id || 0;
        if (node.tls) {
          base.tls = { enabled: true, server_name: node.sni || node.server, insecure: true };
        }
        break;
      case 'ss':
        base.type = 'shadowsocks';
        base.server = node.server;
        base.server_port = node.port;
        base.method = node.cipher || 'aes-256-gcm';
        base.password = node.password || '';
        break;
      case 'trojan':
        base.type = 'trojan';
        base.server = node.server;
        base.server_port = node.port;
        base.password = node.password || '';
        base.tls = { enabled: true, server_name: node.sni || node.server, insecure: true };
        break;
      case 'vless':
        base.type = 'vless';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.flow = node.flow || '';
        if (node.tls) {
          base.tls = { enabled: true, server_name: node.sni || node.server, insecure: true };
        }
        break;
      case 'hysteria2':
        base.type = 'hysteria2';
        base.server = node.server;
        base.server_port = node.port;
        base.password = node.password || '';
        base.tls = { enabled: true, server_name: node.sni || node.server, insecure: true };
        break;
      case 'tuic':
        base.type = 'tuic';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.password = node.password || '';
        base.congestion_control = node.congestion_controller || 'bbr';
        base.tls = { enabled: true, server_name: node.sni || node.server, insecure: true, alpn: ['h3'] };
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
      rules: [{ outbound: 'any', server: 'dns_direct' }],
    },
    inbounds: [{ type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true, strict_route: true }],
    outbounds: [
      ...outbounds,
      { type: 'selector', tag: '🚀 节点选择', outbounds: ['♻️ 自动选择', ...nodes.map(n => n.custom_name || n.name)] },
      { type: 'urltest', tag: '♻️ 自动选择', outbounds: nodes.map(n => n.custom_name || n.name), url: 'http://www.gstatic.com/generate_204', interval: '300s', tolerance: 50 },
      { type: 'direct', tag: 'DIRECT' },
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'DIRECT' },
        { geosite: 'cn', outbound: 'DIRECT' },
        { geoip: 'cn', outbound: 'DIRECT' },
      ],
      final: '🚀 节点选择',
    },
  }, null, 2);
}

module.exports = router;
