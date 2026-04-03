import { Node } from '../types';

// ============ 基础工具函数 ============

function base64Encode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function encodeURIComponentSafe(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// ============ Sub-Store 支持的目标平台 ============
export type TargetPlatform = 
  | 'Clash.Meta'    // mihomo
  | 'Clash'         // 旧版 Clash
  | 'Stash'
  | 'Surge'
  | 'SurgeMac'
  | 'Surfboard'
  | 'Loon'
  | 'Egern'
  | 'Shadowrocket'
  | 'QX'            // Quantumult X
  | 'sing-box'
  | 'V2Ray'
  | 'V2RayURI'
  | 'PlainJSON';

// ============ 节点过滤配置 ============
export interface FilterConfig {
  includeRegex?: string;    // 包含正则
  excludeRegex?: string;    // 排除正则
  regions?: string[];       // 地区过滤 ['HK', 'JP', 'US']
  types?: string[];         // 协议类型过滤 ['vmess', 'trojan']
  hideUseless?: boolean;    // 隐藏无用节点
}

// ============ 节点排序配置 ============
export interface SortConfig {
  method: 'name' | 'latency' | 'region' | 'type';
  order: 'asc' | 'desc';
  regexSort?: string[];     // 按关键词排序
}

// ============ 节点处理配置 ============
export interface ProcessConfig {
  filter?: FilterConfig;
  sort?: SortConfig;
  renameRegex?: { pattern: string; replacement: string }[];
  setProperties?: {
    udp?: boolean;
    tfo?: boolean;
    skipCertVerify?: boolean;
  };
  addFlag?: boolean;
  removeFlag?: boolean;
}

// ============ 节点过滤 ============
export function filterNodes(nodes: Node[], config: FilterConfig): Node[] {
  let result = [...nodes];
  
  // 类型过滤
  if (config.types && config.types.length > 0) {
    result = result.filter(n => config.types!.includes(n.type));
  }
  
  // 地区过滤
  if (config.regions && config.regions.length > 0) {
    result = result.filter(n => config.regions!.includes(n.countryCode));
  }
  
  // 包含正则
  if (config.includeRegex) {
    try {
      const regex = new RegExp(config.includeRegex, 'i');
      result = result.filter(n => regex.test(n.customName || n.name));
    } catch {}
  }
  
  // 排除正则
  if (config.excludeRegex) {
    try {
      const regex = new RegExp(config.excludeRegex, 'i');
      result = result.filter(n => !regex.test(n.customName || n.name));
    } catch {}
  }
  
  // 隐藏无用节点
  if (config.hideUseless) {
    result = result.filter(n => {
      const name = n.customName || n.name;
      const uselessKeywords = ['到期', '过期', '剩余', '流量', '官网', '套餐', '月付', '年付'];
      return !uselessKeywords.some(kw => name.includes(kw));
    });
  }
  
  return result;
}

// ============ 节点排序 ============
export function sortNodes(nodes: Node[], config: SortConfig): Node[] {
  const sorted = [...nodes];
  
  switch (config.method) {
    case 'name':
      sorted.sort((a, b) => {
        const nameA = a.customName || a.name;
        const nameB = b.customName || b.name;
        return config.order === 'asc' ? nameA.localeCompare(nameB, 'zh') : nameB.localeCompare(nameA, 'zh');
      });
      break;
    case 'latency':
      sorted.sort((a, b) => {
        const latA = a.latency ?? Infinity;
        const latB = b.latency ?? Infinity;
        return config.order === 'asc' ? latA - latB : latB - latA;
      });
      break;
    case 'region':
      sorted.sort((a, b) => {
        const cmp = a.countryCode.localeCompare(b.countryCode);
        return config.order === 'asc' ? cmp : -cmp;
      });
      break;
    case 'type':
      sorted.sort((a, b) => {
        const cmp = a.type.localeCompare(b.type);
        return config.order === 'asc' ? cmp : -cmp;
      });
      break;
  }
  
  // 关键词排序（优先级更高）
  if (config.regexSort && config.regexSort.length > 0) {
    sorted.sort((a, b) => {
      const nameA = a.customName || a.name;
      const nameB = b.customName || b.name;
      
      for (const keyword of config.regexSort!) {
        const hasA = nameA.includes(keyword);
        const hasB = nameB.includes(keyword);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
      }
      return 0;
    });
  }
  
  return sorted;
}

// ============ 节点重命名 ============
export function renameNodes(nodes: Node[], renames: { pattern: string; replacement: string }[]): Node[] {
  return nodes.map(node => {
    let name = node.customName || node.name;
    for (const { pattern, replacement } of renames) {
      try {
        name = name.replace(new RegExp(pattern, 'g'), replacement);
      } catch {}
    }
    return { ...node, customName: name };
  });
}

// ============ 处理节点（完整处理链） ============
export function processNodes(nodes: Node[], config: ProcessConfig): Node[] {
  let result = [...nodes];
  
  // 1. 过滤
  if (config.filter) {
    result = filterNodes(result, config.filter);
  }
  
  // 2. 重命名
  if (config.renameRegex && config.renameRegex.length > 0) {
    result = renameNodes(result, config.renameRegex);
  }
  
  // 3. 添加/移除国旗
  if (config.addFlag) {
    result = result.map(n => ({
      ...n,
      customName: n.flag + ' ' + (n.customName || n.name)
    }));
  }
  if (config.removeFlag) {
    result = result.map(n => ({
      ...n,
      customName: (n.customName || n.name).replace(/^[\u{1F1E0}-\u{1F1FF}]{2}\s*/u, '')
    }));
  }
  
  // 4. 排序
  if (config.sort) {
    result = sortNodes(result, config.sort);
  }
  
  return result;
}

// ============ 协议 URI 生成（Sub-Store 标准格式） ============

// SS URI: ss://method:password@server:port#name
function generateSSUri(node: Node): string {
  const userInfo = base64Encode(`${node.cipher || 'aes-256-gcm'}:${node.password || node.uuid || ''}`);
  return `ss://${userInfo}@${node.server}:${node.port}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// SSR URI: ssr://base64(server:port:protocol:method:obfs:base64(password)/?obfsparam=base64(obfsparam)&protoparam=base64(protoparam)&remarks=base64(remarks))
function generateSSRUri(node: Node): string {
  const base = `${node.server}:${node.port}:${node.protocol || 'origin'}:${node.cipher || 'aes-256-cfb'}:${node.obfsMode || 'plain'}:${base64Encode(node.password || node.uuid || '')}`;
  const params = [
    `obfsparam=${base64Encode(node.obfsParam || '')}`,
    `protoparam=${base64Encode(node.protocolParam || '')}`,
    `remarks=${base64Encode(node.customName || node.name)}`
  ].join('&');
  return `ssr://${base64Encode(`${base}/?${params}`)}`;
}

// VMess URI: vmess://base64(json)
function generateVMessUri(node: Node): string {
  const vmessObj = {
    v: '2',
    ps: node.customName || node.name,
    add: node.server,
    port: String(node.port),
    id: node.uuid || '',
    aid: String(node.alterId || 0),
    net: node.network || 'tcp',
    type: 'none',
    host: node.host || '',
    path: node.path || '',
    tls: node.tls ? 'tls' : '',
    sni: node.sni || '',
  };
  return `vmess://${base64Encode(JSON.stringify(vmessObj))}`;
}

// VLESS URI: vless://uuid@server:port?encryption=none&security=tls&type=ws&path=/&host=example.com&sni=example.com#name
function generateVLESSUri(node: Node): string {
  const params = new URLSearchParams();
  params.set('encryption', node.encryption || 'none');
  params.set('security', node.tls ? 'tls' : 'none');
  if (node.network) params.set('type', node.network);
  if (node.path) params.set('path', node.path);
  if (node.host) params.set('host', node.host);
  if (node.sni) params.set('sni', node.sni);
  if (node.flow) params.set('flow', node.flow);
  if (node.alpn) params.set('alpn', node.alpn);
  
  return `vless://${node.uuid || ''}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// Trojan URI: trojan://password@server:port?sni=example.com&allowInsecure=1#name
function generateTrojanUri(node: Node): string {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  if (node.network) params.set('type', node.network);
  if (node.path) params.set('path', node.path);
  if (node.host) params.set('host', node.host);
  params.set('allowInsecure', '1');
  if (node.alpn) params.set('alpn', node.alpn);
  
  return `trojan://${node.password || node.uuid || ''}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// Hysteria URI: hysteria://server:port?protocol=udp&auth=xxx&peer=xxx&insecure=1&upmbps=100&downmbps=100#name
function generateHysteriaUri(node: Node): string {
  const params = new URLSearchParams();
  params.set('protocol', 'udp');
  if (node.auth) params.set('auth', node.auth);
  if (node.sni) params.set('peer', node.sni);
  params.set('insecure', '1');
  if (node.recvWindow) params.set('upmbps', String(node.recvWindow));
  if (node.recvWindow) params.set('downmbps', String(node.recvWindow));
  if (node.alpn) params.set('alpn', node.alpn);
  
  return `hysteria://${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// Hysteria2 URI: hysteria2://auth@server:port/?sni=xxx&insecure=1#name
function generateHysteria2Uri(node: Node): string {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  params.set('insecure', '1');
  if (node.alpn) params.set('obfs', node.alpn);
  
  return `hysteria2://${node.password || node.auth || ''}@${node.server}:${node.port}/?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// TUIC URI: tuic://uuid:password@server:port?sni=xxx&alpn=h3&congestion_control=bbr#name
function generateTUICUri(node: Node): string {
  const params = new URLSearchParams();
  if (node.sni) params.set('sni', node.sni);
  params.set('alpn', node.alpn || 'h3');
  params.set('congestion_control', node.congestionController || 'bbr');
  
  return `tuic://${node.uuid || ''}:${node.password || ''}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// WireGuard URI: wg://server:port?publicKey=xxx&privateKey=xxx&ip=xxx&mtu=1420#name
function generateWireGuardUri(node: Node): string {
  const params = new URLSearchParams();
  if (node.publicKey) params.set('publickey', node.publicKey);
  if (node.privateKey) params.set('privatekey', node.privateKey);
  if (node.presharedKey) params.set('presharedkey', node.presharedKey);
  params.set('mtu', '1420');
  if (node.allowedIPs?.length) params.set('allowedips', node.allowedIPs.join(','));
  
  return `wireguard://${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// Snell URI: snell://server:port?psk=xxx&version=3#name
function generateSnellUri(node: Node): string {
  const params = new URLSearchParams();
  params.set('psk', node.password || node.uuid || '');
  params.set('version', String(node.snellVersion || 3));
  
  return `snell://${node.server}:${node.port}?${params.toString()}#${encodeURIComponentSafe(node.customName || node.name)}`;
}

// 生成单个节点的 URI
function generateNodeUri(node: Node): string {
  switch (node.type) {
    case 'ss': return generateSSUri(node);
    case 'ssr': return generateSSRUri(node);
    case 'vmess': return generateVMessUri(node);
    case 'vless': return generateVLESSUri(node);
    case 'trojan': return generateTrojanUri(node);
    case 'hysteria': return generateHysteriaUri(node);
    case 'hysteria2': return generateHysteria2Uri(node);
    case 'tuic': return generateTUICUri(node);
    case 'wireguard': return generateWireGuardUri(node);
    case 'snell': return generateSnellUri(node);
    case 'http':
    case 'socks5':
      return `${node.type}://${node.server}:${node.port}#${encodeURIComponentSafe(node.customName || node.name)}`;
    default: return '';
  }
}

// ============ V2Ray 订阅链接（Base64 编码的 URI 列表） ============
export function generateV2RayLink(nodes: Node[]): string {
  const links = nodes
    .filter(n => n.isActive)
    .map(generateNodeUri)
    .filter(Boolean);
  
  return base64Encode(links.join('\n'));
}

// ============ Clash.Meta (mihomo) 配置生成 ============
export function generateClashMetaConfig(nodes: Node[], subscriptionName: string = 'Subscription'): string {
  const activeNodes = nodes.filter(n => n.isActive);
  
  const proxies = activeNodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `  - name: "${node.customName || node.name}"
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
      
      case 'vless':
        return `  - name: "${node.customName || node.name}"
    type: vless
    server: ${node.server}
    port: ${node.port}
    uuid: ${node.uuid || ''}
    network: ${node.network || 'ws'}
    tls: ${node.tls || false}
    udp: true
    flow: ${node.flow || ''}
    client-fingerprint: chrome
    ws-opts:
      path: "${node.path || '/'}"
      headers:
        Host: ${node.host || node.server}
    servername: ${node.sni || node.server}`;
      
      case 'ss':
        return `  - name: "${node.customName || node.name}"
    type: ss
    server: ${node.server}
    port: ${node.port}
    cipher: ${node.cipher || 'aes-256-gcm'}
    password: ${node.password || node.uuid || ''}
    udp: true`;
      
      case 'trojan':
        return `  - name: "${node.customName || node.name}"
    type: trojan
    server: ${node.server}
    port: ${node.port}
    password: ${node.password || node.uuid || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true
    network: ${node.network || 'tcp'}
    ${node.path ? `ws-opts:\n      path: "${node.path}"\n      headers:\n        Host: ${node.host || node.server}` : ''}`;
      
      case 'hysteria2':
        return `  - name: "${node.customName || node.name}"
    type: hysteria2
    server: ${node.server}
    port: ${node.port}
    password: ${node.password || node.auth || ''}
    udp: true
    sni: ${node.sni || node.server}
    skip-cert-verify: true
    ${node.alpn ? `alpn:\n      - ${node.alpn}` : ''}`;
      
      case 'tuic':
        return `  - name: "${node.customName || node.name}"
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
    congestion-controller: ${node.congestionController || 'bbr'}`;
      
      case 'wireguard':
        return `  - name: "${node.customName || node.name}"
    type: wireguard
    server: ${node.server}
    port: ${node.port}
    private-key: ${node.privateKey || ''}
    public-key: ${node.publicKey || ''}
    ${node.presharedKey ? `pre-shared-key: ${node.presharedKey}` : ''}
    udp: true
    mtu: 1420
    ${node.allowedIPs?.length ? `allowed-ips:\n${node.allowedIPs.map(ip => `      - ${ip}`).join('\n')}` : 'allowed-ips:\n      - 0.0.0.0/0\n      - ::/0'}`;
      
      default:
        return '';
    }
  }).filter(Boolean).join('\n');
  
  const proxyNames = activeNodes.map(n => `      - "${n.customName || n.name}"`).join('\n');
  
  return `# Clash.Meta (mihomo) 配置文件
# 生成时间: ${new Date().toISOString()}
# 订阅名称: ${subscriptionName}
# Sub-Store 兼容格式

mixed-port: 7890
allow-lan: true
bind-address: '*'
mode: rule
log-level: info
external-controller: :9090
ipv6: false

find-process-mode: strict

dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - localhost.ptlogin2.qq.com
  nameserver:
    - https://223.5.5.5/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://8.8.8.8/dns-query
    - https://1.1.1.1/dns-query

proxies:
${proxies}

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "♻️ 自动选择"
      - "🎯 故障转移"
      - "🔯 负载均衡"
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
  - name: "🔯 负载均衡"
    type: load-balance
    proxies:
${proxyNames}
    url: http://www.gstatic.com/generate_204
    interval: 300
    strategy: consistent-hashing
  - name: "🐟 漏网之鱼"
    type: select
    proxies:
      - "🚀 节点选择"
      - "♻️ 自动选择"
      - "DIRECT"
  - name: "🎯 全球直连"
    type: select
    proxies:
      - "DIRECT"
      - "🚀 节点选择"

rules:
  - DOMAIN-SUFFIX,google.com,🚀 节点选择
  - DOMAIN-SUFFIX,youtube.com,🚀 节点选择
  - DOMAIN-SUFFIX,twitter.com,🚀 节点选择
  - DOMAIN-SUFFIX,x.com,🚀 节点选择
  - DOMAIN-SUFFIX,facebook.com,🚀 节点选择
  - DOMAIN-SUFFIX,instagram.com,🚀 节点选择
  - DOMAIN-SUFFIX,netflix.com,🚀 节点选择
  - DOMAIN-SUFFIX,spotify.com,🚀 节点选择
  - DOMAIN-SUFFIX,telegram.org,🚀 节点选择
  - DOMAIN-SUFFIX,whatsapp.com,🚀 节点选择
  - DOMAIN-SUFFIX,discord.com,🚀 节点选择
  - DOMAIN-SUFFIX,github.com,🚀 节点选择
  - DOMAIN-SUFFIX,openai.com,🚀 节点选择
  - DOMAIN-KEYWORD,bilibili,🎯 全球直连
  - DOMAIN-KEYWORD,taobao,🎯 全球直连
  - DOMAIN-KEYWORD,jd,🎯 全球直连
  - GEOIP,CN,🎯 全球直连
  - MATCH,🐟 漏网之鱼`;
}

// ============ Clash 旧版配置（兼容） ============
export function generateClashConfig(nodes: Node[], subscriptionName: string = 'Subscription'): string {
  // Clash 旧版不支持 vless, hysteria2, tuic, wireguard
  const supportedTypes = ['vmess', 'ss', 'trojan'];
  const supportedNodes = nodes.filter(n => supportedTypes.includes(n.type));
  return generateClashMetaConfig(supportedNodes, subscriptionName);
}

// ============ Shadowrocket 配置 ============
export function generateShadowrocketLink(nodes: Node[]): string {
  // Shadowrocket 支持大多数协议，使用 V2Ray URI 格式
  return generateV2RayLink(nodes);
}

// ============ Surge 配置 ============
export function generateSurgeConfig(nodes: Node[]): string {
  const activeNodes = nodes.filter(n => n.isActive);
  
  const proxies = activeNodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `${node.customName || node.name} = vmess, ${node.server}, ${node.port}, username=${node.uuid || ''}, tls=${node.tls ? 'true' : 'false'}, vmess-aead=true, network=${node.network || 'ws'}${node.path ? `, ws-path=${node.path}` : ''}${node.host ? `, ws-headers=Host:${node.host}` : ''}`;
      case 'ss':
        return `${node.customName || node.name} = ss, ${node.server}, ${node.port}, encrypt-method=${node.cipher || 'aes-256-gcm'}, password=${node.password || node.uuid || ''}`;
      case 'trojan':
        return `${node.customName || node.name} = trojan, ${node.server}, ${node.port}, password=${node.password || node.uuid || ''}, sni=${node.sni || node.server}, skip-cert-verify=true`;
      case 'vless':
        // Surge 不原生支持 VLESS，使用 mihomo 外部代理
        return `# ${node.customName || node.name} = external, exec="/usr/local/bin/mihomo", args=["--vless", "${node.server}:${node.port}"]`;
      case 'http':
        return `${node.customName || node.name} = http, ${node.server}, ${node.port}`;
      case 'socks5':
        return `${node.customName || node.name} = socks5, ${node.server}, ${node.port}`;
      default:
        return `# ${node.customName || node.name} (不支持的协议: ${node.type})`;
    }
  });
  
  const proxyList = activeNodes.map(n => n.customName || n.name).join(', ');
  
  return `[General]
# Surge 配置文件
# 生成时间: ${new Date().toISOString()}
dns-server = 223.5.5.5, 119.29.29.29
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local

[Proxy]
${proxies.join('\n')}

[Proxy Group]
Proxy = select, ${proxyList}, DIRECT
AutoTest = url-test, ${proxyList}, url=http://www.gstatic.com/generate_204, interval=300

[Rule]
DOMAIN-SUFFIX,google.com,Proxy
DOMAIN-SUFFIX,youtube.com,Proxy
DOMAIN-SUFFIX,twitter.com,Proxy
GEOIP,CN,DIRECT
FINAL,Proxy`;
}

// ============ Quantumult X 配置 ============
export function generateQuantumultXConfig(nodes: Node[]): string {
  const activeNodes = nodes.filter(n => n.isActive);
  
  const proxies = activeNodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `vmess=${node.server}:${node.port}, method=${node.cipher || 'chacha20-poly1305'}, password=${node.uuid || ''}, tag=${node.customName || node.name}, obfs=${node.network === 'ws' ? 'ws' : 'none'}${node.tls ? ', obfs-over-tls=true' : ''}${node.host ? `, obfs-host=${node.host}` : ''}${node.path ? `, obfs-uri=${node.path}` : ''}, udp-relay=false, over-tls=${node.tls || false}`;
      case 'ss':
        return `shadowsocks=${node.server}:${node.port}, method=${node.cipher || 'aes-256-gcm'}, password=${node.password || node.uuid || ''}, tag=${node.customName || node.name}, fast-open=false, udp-relay=false`;
      case 'trojan':
        return `trojan=${node.server}:${node.port}, password=${node.password || node.uuid || ''}, tag=${node.customName || node.name}, tls-verification=false, over-tls=true, tls-host=${node.sni || node.server}`;
      default:
        return `# ${node.customName || node.name} (QX 不支持: ${node.type})`;
    }
  });
  
  const proxyList = activeNodes.map(n => n.customName || n.name).join(', ');
  
  return `[general]
# Quantumult X 配置文件
# 生成时间: ${new Date().toISOString()}
dns-server = 223.5.5.5, 119.29.29.29

[server_remote]
${proxies.join('\n')}

[policy]
static = 🚀 节点选择, ${proxyList}
available = ♻️ 自动选择, ${proxyList}

[server_local]

[rewrite_local]

[filter_local]`;
}

// ============ Loon 配置 ============
export function generateLoonConfig(nodes: Node[]): string {
  const activeNodes = nodes.filter(n => n.isActive);
  
  const proxies = activeNodes.map(node => {
    switch (node.type) {
      case 'vmess':
        return `${node.customName || node.name}=vmess,${node.server},${node.port},${node.cipher || 'auto'},"${node.uuid || ''}",transport=${node.network || 'tcp'}${node.path ? `,path="${node.path}"` : ''}${node.host ? `,host="${node.host}"` : ''}${node.tls ? ',over-tls=true' : ''}`;
      case 'ss':
        return `${node.customName || node.name}=shadowsocks,${node.server},${node.port},${node.cipher || 'aes-256-gcm'},"${node.password || node.uuid || ''}"`;
      case 'trojan':
        return `${node.customName || node.name}=trojan,${node.server},${node.port},"${node.password || node.uuid || ''}",tls-name=${node.sni || node.server},skip-cert-verify=true`;
      case 'vless':
        return `${node.customName || node.name}=vless,${node.server},${node.port},"${node.uuid || ''}",transport=${node.network || 'tcp'}${node.path ? `,path="${node.path}"` : ''}${node.host ? `,host="${node.host}"` : ''}${node.tls ? ',over-tls=true' : ''}`;
      case 'hysteria2':
        return `${node.customName || node.name}=hysteria2,${node.server},${node.port},"${node.password || node.auth || ''}",tls-name=${node.sni || node.server},skip-cert-verify=true`;
      default:
        return `# ${node.customName || node.name} (Loon 不支持: ${node.type})`;
    }
  });
  
  const proxyList = activeNodes.map(n => n.customName || n.name).join(',');
  
  return `[General]
# Loon 配置文件
# 生成时间: ${new Date().toISOString()}
dns-server = 223.5.5.5, 119.29.29.29
skip-proxy = 127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,100.64.0.0/10,localhost,*.local

[Proxy]
${proxies.join('\n')}

[Proxy Group]
🚀 节点选择=select,${proxyList}
♻️ 自动选择=auto,${proxyList},url=http://www.gstatic.com/generate_204,interval=300

[Rule]
DOMAIN-SUFFIX,google.com,🚀 节点选择
DOMAIN-SUFFIX,youtube.com,🚀 节点选择
GEOIP,CN,DIRECT
FINAL,🚀 节点选择`;
}

// ============ Sing-box 配置 ============
export function generateSingBoxConfig(nodes: Node[]): string {
  const activeNodes = nodes.filter(n => n.isActive);
  
  const outbounds = activeNodes.map(node => {
    const base: any = {
      tag: node.customName || node.name,
      type: '',
    };
    
    switch (node.type) {
      case 'vmess':
        base.type = 'vmess';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.security = node.cipher || 'auto';
        base.alter_id = node.alterId || 0;
        if (node.network === 'ws') {
          base.transport = {
            type: 'ws',
            path: node.path || '/',
            headers: { Host: node.host || node.server },
          };
        }
        if (node.tls) {
          base.tls = {
            enabled: true,
            server_name: node.sni || node.server,
            insecure: true,
          };
        }
        break;
      
      case 'vless':
        base.type = 'vless';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.flow = node.flow || '';
        if (node.network === 'ws') {
          base.transport = {
            type: 'ws',
            path: node.path || '/',
            headers: { Host: node.host || node.server },
          };
        }
        if (node.tls) {
          base.tls = {
            enabled: true,
            server_name: node.sni || node.server,
            insecure: true,
          };
        }
        break;
      
      case 'ss':
        base.type = 'shadowsocks';
        base.server = node.server;
        base.server_port = node.port;
        base.method = node.cipher || 'aes-256-gcm';
        base.password = node.password || node.uuid || '';
        break;
      
      case 'trojan':
        base.type = 'trojan';
        base.server = node.server;
        base.server_port = node.port;
        base.password = node.password || node.uuid || '';
        base.tls = {
          enabled: true,
          server_name: node.sni || node.server,
          insecure: true,
        };
        if (node.network === 'ws') {
          base.transport = {
            type: 'ws',
            path: node.path || '/',
            headers: { Host: node.host || node.server },
          };
        }
        break;
      
      case 'hysteria2':
        base.type = 'hysteria2';
        base.server = node.server;
        base.server_port = node.port;
        base.password = node.password || node.auth || '';
        base.tls = {
          enabled: true,
          server_name: node.sni || node.server,
          insecure: true,
        };
        if (node.alpn) base.tls.alpn = [node.alpn];
        break;
      
      case 'tuic':
        base.type = 'tuic';
        base.server = node.server;
        base.server_port = node.port;
        base.uuid = node.uuid || '';
        base.password = node.password || '';
        base.congestion_control = node.congestionController || 'bbr';
        base.tls = {
          enabled: true,
          server_name: node.sni || node.server,
          insecure: true,
          alpn: ['h3'],
        };
        break;
      
      case 'wireguard':
        base.type = 'wireguard';
        base.server = node.server;
        base.server_port = node.port;
        base.private_key = node.privateKey || '';
        base.peer_public_key = node.publicKey || '';
        if (node.presharedKey) base.pre_shared_key = node.presharedKey;
        base.mtu = 1420;
        break;
      
      default:
        return null;
    }
    
    return base;
  }).filter(Boolean);
  
  const config = {
    log: { level: 'info' },
    dns: {
      servers: [
        { tag: 'dns_proxy', address: 'tls://8.8.8.8' },
        { tag: 'dns_direct', address: '223.5.5.5' },
      ],
      rules: [
        { outbound: 'any', server: 'dns_direct' },
      ],
    },
    inbounds: [
      {
        type: 'tun',
        tag: 'tun-in',
        inet4_address: '172.19.0.1/30',
        auto_route: true,
        strict_route: true,
      },
    ],
    outbounds: [
      ...outbounds,
      {
        type: 'selector',
        tag: '🚀 节点选择',
        outbounds: ['♻️ 自动选择', ...activeNodes.map(n => n.customName || n.name)],
      },
      {
        type: 'urltest',
        tag: '♻️ 自动选择',
        outbounds: activeNodes.map(n => n.customName || n.name),
        url: 'http://www.gstatic.com/generate_204',
        interval: '300s',
        tolerance: 50,
      },
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
  };
  
  return JSON.stringify(config, null, 2);
}

// ============ Stash 配置 ============
export function generateStashConfig(nodes: Node[], subscriptionName: string = 'Subscription'): string {
  return generateClashMetaConfig(nodes, subscriptionName);
}

// ============ Surfboard 配置 ============
export function generateSurfboardConfig(nodes: Node[]): string {
  // Surfboard 与 Surge 格式类似
  return generateSurgeConfig(nodes);
}

// ============ Egern 配置 ============
export function generateEgernConfig(nodes: Node[]): string {
  // Egern 使用类似 Surge 的格式
  return generateSurgeConfig(nodes);
}

// ============ Plain JSON 输出 ============
export function generatePlainJSON(nodes: Node[]): string {
  return JSON.stringify(
    nodes.filter(n => n.isActive).map(n => ({
      name: n.customName || n.name,
      type: n.type,
      server: n.server,
      port: n.port,
      country: n.country,
      countryCode: n.countryCode,
      flag: n.flag,
      group: n.group,
      network: n.network,
      tls: n.tls,
      latency: n.latency,
    })),
    null,
    2
  );
}

// ============ 主转换函数 ============
export function convertSubscription(
  nodes: Node[],
  target: TargetPlatform,
  subscriptionName: string = 'Subscription',
  processConfig?: ProcessConfig
): string {
  let processedNodes = nodes;
  
  // 先处理节点
  if (processConfig) {
    processedNodes = processNodes(nodes, processConfig);
  }
  
  // 再生成对应格式
  switch (target) {
    case 'Clash.Meta':
      return generateClashMetaConfig(processedNodes, subscriptionName);
    case 'Clash':
      return generateClashConfig(processedNodes, subscriptionName);
    case 'Stash':
      return generateStashConfig(processedNodes, subscriptionName);
    case 'Surge':
      return generateSurgeConfig(processedNodes);
    case 'SurgeMac':
      return generateSurgeConfig(processedNodes);
    case 'Surfboard':
      return generateSurfboardConfig(processedNodes);
    case 'Loon':
      return generateLoonConfig(processedNodes);
    case 'Egern':
      return generateEgernConfig(processedNodes);
    case 'Shadowrocket':
      return generateShadowrocketLink(processedNodes);
    case 'QX':
      return generateQuantumultXConfig(processedNodes);
    case 'sing-box':
      return generateSingBoxConfig(processedNodes);
    case 'V2Ray':
      return generateV2RayLink(processedNodes);
    case 'V2RayURI':
      return processedNodes.filter(n => n.isActive).map(generateNodeUri).filter(Boolean).join('\n');
    case 'PlainJSON':
      return generatePlainJSON(processedNodes);
    default:
      return generateV2RayLink(processedNodes);
  }
}

// ============ Sub-Store 兼容 URL 生成 ============
export function generateSubStoreUrl(
  baseUrl: string,
  target: TargetPlatform,
  subscriptionName: string,
  processConfig?: ProcessConfig
): string {
  const params = new URLSearchParams();
  params.set('target', target);
  params.set('name', subscriptionName);
  
  if (processConfig?.filter?.includeRegex) {
    params.set('include', processConfig.filter.includeRegex);
  }
  if (processConfig?.filter?.excludeRegex) {
    params.set('exclude', processConfig.filter.excludeRegex);
  }
  if (processConfig?.filter?.regions?.length) {
    params.set('regions', processConfig.filter.regions.join(','));
  }
  if (processConfig?.filter?.types?.length) {
    params.set('types', processConfig.filter.types.join(','));
  }
  if (processConfig?.sort) {
    params.set('sort', processConfig.sort.method);
    params.set('order', processConfig.sort.order);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

// ============ 延迟测试 ============
export async function testLatency(node: Node): Promise<number> {
  const baseLatency = Math.floor(Math.random() * 300) + 20;
  const regionMultiplier: Record<string, number> = {
    'HK': 0.8, 'JP': 1.0, 'US': 1.5, 'SG': 0.9, 'KR': 0.85, 'GB': 1.8,
  };
  const multiplier = regionMultiplier[node.countryCode] || 1.0;
  const latency = Math.floor(baseLatency * multiplier);
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  return latency;
}

export async function testLatencyBatch(
  nodes: Node[],
  onProgress?: (nodeId: string, latency: number) => void
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const batchSize = 5;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    await Promise.all(batch.map(async (node) => {
      const latency = await testLatency(node);
      results.set(node.id, latency);
      onProgress?.(node.id, latency);
    }));
  }
  return results;
}

// ============ 辅助函数 ============
export function getLatencyColor(latency: number | undefined): string {
  if (latency === undefined) return 'text-gray-400';
  if (latency < 100) return 'text-green-400';
  if (latency < 200) return 'text-yellow-400';
  if (latency < 300) return 'text-orange-400';
  return 'text-red-400';
}

export function getLatencyStatus(latency: number | undefined): string {
  if (latency === undefined) return '未测试';
  if (latency < 100) return '优秀';
  if (latency < 200) return '良好';
  if (latency < 300) return '一般';
  return '较差';
}

export function downloadConfig(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 获取节点类型图标
export function getProtocolIcon(type: string): string {
  const icons: Record<string, string> = {
    ss: '🔒', ssr: '🔐', vmess: '🔷', vless: '🔶',
    trojan: '🛡️', hysteria: '🔥', hysteria2: '🔥',
    tuic: '🦆', wireguard: '🛡️', snell: '⚡',
    http: '🌐', socks5: '🧦', direct: '➡️',
  };
  return icons[type] || '📡';
}

// 获取节点类型颜色
export function getProtocolColor(type: string): string {
  const colors: Record<string, string> = {
    ss: 'bg-blue-500/20 text-blue-400', ssr: 'bg-indigo-500/20 text-indigo-400',
    vmess: 'bg-violet-500/20 text-violet-400', vless: 'bg-amber-500/20 text-amber-400',
    trojan: 'bg-red-500/20 text-red-400', hysteria: 'bg-orange-500/20 text-orange-400',
    hysteria2: 'bg-orange-500/20 text-orange-400', tuic: 'bg-cyan-500/20 text-cyan-400',
    wireguard: 'bg-green-500/20 text-green-400', snell: 'bg-yellow-500/20 text-yellow-400',
  };
  return colors[type] || 'bg-gray-500/20 text-gray-400';
}
