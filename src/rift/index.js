// ==================== 裂隙行者 5% · 整合入口 ====================
// 把 State / Economy / Climb 三个模块挂到 window.Rift
// 同时桥接老 Game 模块（aggregateBuild / calcDPS / simulateBattle 等）
//
// 用法（HTML）：
//   <script src="data.js"></script>
//   <script src="game.js"></script>
//   <script src="rift/state.js"></script>
//   <script src="rift/battle.js"></script>
//   <script src="rift/economy.js"></script>
//   <script src="rift/climb.js"></script>
//   <script src="rift/index.js"></script>
//
// 暴露 window.Rift = { State, Economy, Climb, version }

(function () {
  'use strict';

  // ---- 模块握手 ----
  // 三个子模块均使用 const X = {} 模式挂全局
  if (typeof window.RiftState === 'undefined') window.RiftState = window.RiftState || {};
  if (typeof window.Economy === 'undefined')    window.Economy    = window.Economy    || {};
  if (typeof window.Climb === 'undefined')      window.Climb      = window.Climb      || {};
  if (typeof window.RiftBattle === 'undefined') window.RiftBattle = window.RiftBattle || {};
  if (typeof window.Game === 'undefined')       window.Game       = window.Game       || {};

  window.Rift = {
    State:   window.RiftState,
    Economy: window.Economy,
    Climb:   window.Climb,
    Battle:  window.RiftBattle,
    Game:    window.Game,
    Rest:    window.Rest,
    version: '2.1.0',
    buildAt: '2026-07-08'
  };

  // ---- 一键 debug 入口 ----
  // 你在浏览器 console 跑 Rift.debug.runFullSim(floor=5) 能直接跑一次端到端
  window.Rift.debug = {
    runFullSim: function (targetFloor) {
      targetFloor = targetFloor || 5;
      console.log('[Rift] === 端到端 smoke test (target=' + targetFloor + ') ===');
      var s = window.RiftState.getState();
      console.log('[Rift] state keys:', Object.keys(s));
      var m = window.Climb.spawnMonsterForFloor(targetFloor);
      console.log('[Rift] floor ' + targetFloor + ' monster:', m.name, '(hp=' + m.hp + ', boss=' + !!m.boss + ')');
      if (m.boss) {
        var mc = window.Climb.showMoralChoice(m.id);
        console.log('[Rift] moral choice:', mc.bossName, '→ A=终结 / B=守护');
      }
      console.log('[Rift] === smoke test ok ===');
    },
    runEconomySelfTest: function () {
      console.log('[Rift] running economy self-test...');
      // 调用子模块自带的 self-test（如果暴露）
      if (typeof window.__RiftSelfTest === 'function') {
        window.__RiftSelfTest();
      } else {
        console.log('[Rift] no self-test registered; economy module exports look fine.');
        console.log('[Rift] economy exports:', Object.keys(window.Economy).filter(function(k){return typeof window.Economy[k]==='function'}));
      }
    }
  };

  console.log('[Rift] v' + window.Rift.version + ' loaded · modules:', Object.keys(window.Rift).join(','));
})();
