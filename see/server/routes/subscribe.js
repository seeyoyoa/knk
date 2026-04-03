// 订阅端点路由 - 供客户端直接访问
const express = require('express');
const router = express.Router();
const { getSubscription } = require('../services/subscription');

/**
 * 订阅链接端点
 * GET /api/subscribe/:token
 * Query: ?target=clash|surge|singbox|v2ray
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const target = req.query.target || 'base64';

    const result = await getSubscription(token);

    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }

    const { userInfo, formats } = result.data;

    // 设置订阅信息头
    const totalBytes = userInfo.dataLimit * 1024 * 1024 * 1024;
    const usedBytes = userInfo.dataUsed * 1024 * 1024 * 1024;
    const expireTimestamp = userInfo.planExpire ? new Date(userInfo.planExpire).getTime() : 0;

    res.set({
      'Subscription-Userinfo': `upload=${usedBytes}; download=${usedBytes}; total=${totalBytes}; expire=${expireTimestamp}`,
      'Content-Disposition': `attachment; filename="subscription.txt"`,
      'Profile-Update-Interval': '24'
    });

    // 根据目标格式返回
    switch (target.toLowerCase()) {
      case 'clash':
      case 'mihomo':
        res.set('Content-Type', 'text/yaml');
        return res.send(JSON.stringify(formats.clash, null, 2));

      case 'surge':
        res.set('Content-Type', 'text/plain');
        return res.send(formats.surge);

      case 'singbox':
        res.set('Content-Type', 'application/json');
        return res.json(formats.singbox);

      case 'v2ray':
      case 'base64':
      default:
        res.set('Content-Type', 'text/plain');
        return res.send(formats.base64);
    }
  } catch (error) {
    console.error('订阅端点错误:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
