/* ============================================================
   Veyro Game Database + Game Optimizer.
   Library of supported titles with FPS estimates (always
   labeled as estimates) and per-game recommended settings.
   ============================================================ */
console.log('[games.js] loading...');
Veyro.Games = (() => {
  'use strict';

  const DB = [
    { id: 'fortnite', name: 'Fortnite', weight: 1.02, res: '1080p', genre: 'Battle Royale',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Mode', cur: 'Resolution (DX12)', rec: 'Performance (DX11)' },
        { k: 'View Distance', cur: 'Epic', rec: 'Far' },
        { k: 'Textures', cur: 'Epic', rec: 'Low' },
        { k: 'Shadows', cur: 'Epic', rec: 'Off' },
        { k: 'Effects', cur: 'Epic', rec: 'Low' },
        { k: 'VSync', cur: 'Off', rec: 'Off' },
        { k: 'FPS Limit', cur: 'Unlimited', rec: '144' },
        { k: 'Graphics quality', cur: 'Epic', rec: 'Custom (Perf)' }
      ] },
    { id: 'cs2', name: 'Counter-Strike 2', weight: 1.32, res: '1080p', genre: 'Tactical Shooter',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Global Shadow Quality', cur: 'High', rec: 'Medium' },
        { k: 'Model / Texture Detail', cur: 'High', rec: 'Medium' },
        { k: 'Shader Detail', cur: 'High', rec: 'Low' },
        { k: 'Particle Detail', cur: 'High', rec: 'Low' },
        { k: 'Ambient Occlusion', cur: 'High', rec: 'Disabled' },
        { k: 'MSAA', cur: '4x', rec: '2x' },
        { k: 'VSync', cur: 'Disabled', rec: 'Disabled' }
      ] },
    { id: 'gta5', name: 'GTA V', weight: 0.9, res: '1080p', genre: 'Open World',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'FXAA', cur: 'On', rec: 'On' },
        { k: 'MSAA', cur: '4x', rec: 'Off' },
        { k: 'Population Density', cur: '10/10', rec: '8/10' },
        { k: 'Post FX', cur: 'Very High', rec: 'High' },
        { k: 'Shadow Quality', cur: 'Very High', rec: 'High' },
        { k: 'Texture Quality', cur: 'High', rec: 'High' },
        { k: 'Grass Quality', cur: 'Ultra', rec: 'High' },
        { k: 'VSync', cur: 'On', rec: 'Off' }
      ] },
    { id: 'minecraft', name: 'Minecraft', weight: 0.85, res: '1080p', genre: 'Sandbox',
      settings: [
        { k: 'Render Distance', cur: '16 chunks', rec: '12 chunks' },
        { k: 'Graphics', cur: 'Fancy', rec: 'Fast' },
        { k: 'Smooth Lighting', cur: 'Max', rec: 'Off' },
        { k: 'Particles', cur: 'All', rec: 'Minimal' },
        { k: 'Clouds', cur: 'Fancy', rec: 'Off' },
        { k: 'Max FPS', cur: 'Unlimited', rec: '240' }
      ] },
    { id: 'valorant', name: 'Valorant', weight: 1.38, res: '1080p', genre: 'Tactical Shooter',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Graphics Quality', cur: 'High', rec: 'Low' },
        { k: 'Material Quality', cur: 'High', rec: 'Low' },
        { k: 'Anisotropic Filtering', cur: '8x', rec: '4x' },
        { k: 'Bloom', cur: 'On', rec: 'Off' },
        { k: 'Distortion', cur: 'On', rec: 'Off' },
        { k: 'Limit FPS in Background', cur: '30', rec: 'Off' }
      ] },
    { id: 'warzone', name: 'Warzone', weight: 0.86, res: '1080p', genre: 'Battle Royale',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Render Resolution', cur: '100%', rec: '80%' },
        { k: 'Quality Preset', cur: 'Balanced', rec: 'Minimum' },
        { k: 'Textures', cur: 'High', rec: 'Low' },
        { k: 'On-Demand Textures', cur: 'On', rec: 'Off' },
        { k: 'Ambient Occlusion', cur: 'On', rec: 'Off' },
        { k: 'FidelityFX CAS', cur: 'Off', rec: 'On (90%)' },
        { k: 'VRAM Target', cur: '90%', rec: '70%' }
      ] },
    { id: 'apex', name: 'Apex Legends', weight: 0.98, res: '1080p', genre: 'Battle Royale',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Model Quality', cur: 'High', rec: 'Medium' },
        { k: 'Texture Budget', cur: 'High', rec: 'Medium' },
        { k: 'Ambient Occlusion', cur: 'High', rec: 'Medium' },
        { k: 'Spot Shadows', cur: 'High', rec: 'Low' },
        { k: 'Sun Shadows', cur: 'High', rec: 'Low' },
        { k: 'Anti-Aliasing', cur: '4x MSAA', rec: 'TSAA' },
        { k: 'Adaptive FPS Target', cur: 'Off', rec: '144' }
      ] },
    { id: 'rocket', name: 'Rocket League', weight: 1.12, res: '1080p', genre: 'Sports',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'World Detail', cur: 'High Quality', rec: 'High Performance' },
        { k: 'Particle Detail', cur: 'High Quality', rec: 'High Performance' },
        { k: 'Ambient Occlusion', cur: 'On', rec: 'Off' },
        { k: 'Bloom', cur: 'On', rec: 'Off' },
        { k: 'Motion Blur', cur: 'On', rec: 'Off' },
        { k: 'VSync', cur: 'On', rec: 'Off' },
        { k: 'Max FPS', cur: 'Uncapped', rec: '144' }
      ] },
    { id: 'ow2', name: 'Overwatch 2', weight: 1.18, res: '1080p', genre: 'Hero Shooter',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Render Scale', cur: '100%', rec: '100%' },
        { k: 'Quality Preset', cur: 'High', rec: 'Low' },
        { k: 'Textures', cur: 'High', rec: 'Medium' },
        { k: 'Local Fog Details', cur: 'High', rec: 'Low' },
        { k: 'Dynamic Reflections', cur: 'High', rec: 'Off' },
        { k: 'VSync', cur: 'On', rec: 'Off' },
        { k: 'Frame Rate', cur: 'Display-based', rec: 'Custom (144)' }
      ] },
    { id: 'r6', name: 'Rainbow Six Siege', weight: 1.22, res: '1080p', genre: 'Tactical Shooter',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Texture Quality', cur: 'High', rec: 'Medium' },
        { k: 'LOD Quality', cur: 'High', rec: 'Medium' },
        { k: 'Shadow Quality', cur: 'High', rec: 'Medium' },
        { k: 'Reflection Quality', cur: 'High', rec: 'Low' },
        { k: 'Ambient Occlusion', cur: 'High', rec: 'Off' },
        { k: 'Anti-Aliasing', cur: 'MSAA 4x', rec: 'T-AA' },
        { k: 'FPS Cap', cur: 'Unlimited', rec: '144' }
      ] },
    { id: 'pubg', name: 'PUBG: Battlegrounds', weight: 0.88, res: '1080p', genre: 'Battle Royale',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1728×972' },
        { k: 'Overall Quality', cur: 'Ultra', rec: 'Custom' },
        { k: 'Textures', cur: 'Ultra', rec: 'Medium' },
        { k: 'Shadows', cur: 'Ultra', rec: 'Low' },
        { k: 'Effects', cur: 'Ultra', rec: 'Low' },
        { k: 'View Distance', cur: 'Ultra', rec: 'High' },
        { k: 'Motion Blur', cur: 'On', rec: 'Off' },
        { k: 'Sharpen', cur: 'Off', rec: 'On' }
      ] },
    { id: 'eldenring', name: 'Elden Ring', weight: 0.78, res: '1080p', genre: 'Action RPG',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Quality', cur: 'High', rec: 'Medium' },
        { k: 'Anti-Aliasing', cur: 'High', rec: 'Medium' },
        { k: 'Texture Quality', cur: 'High', rec: 'Medium' },
        { k: 'Shadow Quality', cur: 'High', rec: 'Medium' },
        { k: 'Volumetrics', cur: 'High', rec: 'Off' },
        { k: 'Motion Blur', cur: 'On', rec: 'Off' },
        { k: 'Grass Quality', cur: 'High', rec: 'Low' }
      ] },
    { id: 'cyberpunk', name: 'Cyberpunk 2077', weight: 0.72, res: '1080p', genre: 'Action RPG',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Quality Preset', cur: 'Ultra', rec: 'Custom' },
        { k: 'Volumetric Fog', cur: 'Ultra', rec: 'Low' },
        { k: 'Volumetric Clouds', cur: 'Ultra', rec: 'Off' },
        { k: 'Screen Space Reflections', cur: 'Ultra', rec: 'Medium' },
        { k: 'Ray Tracing', cur: 'On', rec: 'Off' },
        { k: 'Ambient Occlusion', cur: 'Ultra', rec: 'Medium' },
        { k: 'DLSS / FSR', cur: 'Off', rec: 'On (Balanced)' }
      ] },
    { id: 'eafc', name: 'EA Sports FC 25', weight: 1.06, res: '1080p', genre: 'Sports',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Rendering Quality', cur: 'High', rec: 'Medium' },
        { k: 'Anti-Aliasing', cur: 'High', rec: 'Medium' },
        { k: 'Dynamic Resolution', cur: 'Off', rec: 'On' },
        { k: 'Visual Effects', cur: 'High', rec: 'Low' },
        { k: 'Shadow Quality', cur: 'High', rec: 'Medium' },
        { k: 'Motion Blur', cur: 'On', rec: 'Off' },
        { k: 'Refresh Rate', cur: 'Display-based', rec: 'Custom (144)' }
      ] },
    { id: 'f1', name: 'F1 24', weight: 0.95, res: '1080p', genre: 'Racing',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Preset', cur: 'High', rec: 'Custom' },
        { k: 'Textures', cur: 'High', rec: 'Medium' },
        { k: 'Shadows', cur: 'High', rec: 'Medium' },
        { k: 'Reflections', cur: 'High', rec: 'Medium' },
        { k: 'Mirrors', cur: 'High', rec: 'Low' },
        { k: 'Ambient Occlusion', cur: 'High', rec: 'Medium' },
        { k: 'Anti-Aliasing', cur: 'TAA', rec: 'FXAA' }
      ] },
    { id: 'dota2', name: 'Dota 2', weight: 1.15, res: '1080p', genre: 'MOBA',
      settings: [
        { k: 'Resolution', cur: '1920×1080', rec: '1920×1080' },
        { k: 'Rendering Quality', cur: 'High', rec: 'Medium' },
        { k: 'Shadow Quality', cur: 'High', rec: 'Medium' },
        { k: 'Ambient Occlusion', cur: 'On', rec: 'Off' },
        { k: 'Anti-Aliasing', cur: '4x', rec: '2x' },
        { k: 'Bloom', cur: 'On', rec: 'Off' },
        { k: 'Max FPS', cur: 'Uncapped', rec: '144' },
        { k: 'VSync', cur: 'On', rec: 'Off' }
      ] }
  ];

  function all() { return DB; }

  function get(id) { return DB.find(g => g.id === id); }

  function genres() {
    const genres = [...new Set(DB.map(g => g.genre).filter(Boolean))];
    return genres.sort();
  }

  /* ---------------- game optimizer ---------------- */

  const applied = new Map();

  async function apply(game, snap) {
    /* Persist to demo agent + registry so UNDO works. */
    try { await Veyro.HardwareAgent.setOptimization('game_' + game.id, true); } catch (e) {}
    applied.set(game.id, true);
    return {
      game: game.name,
      changed: game.settings.map(s => ({ setting: s.k, from: s.cur, to: s.rec }))
    };
  }

  function undo(game) {
    applied.delete(game.id);
    try { Veyro.HardwareAgent.setOptimization('game_' + game.id, false); } catch (e) {}
    return true;
  }

  function isApplied(id) { return applied.has(id); }

  return { all, get, apply, undo, isApplied, genres };
})();