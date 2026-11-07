/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrderTicketBar } from './components/OrderTicketBar';
import {
  PixelCharacterAvatar,
  PixelItemIcon,
} from './components/PixelSprites';
import { RecipeLabPanel } from './components/RecipeLabPanel';
import {
  getRegularHeartLevel,
  RegularsPanel,
  StoryEventModal,
} from './components/RegularsPanel';
import { getFrontTile, ShopFloorCanvas } from './components/ShopFloorCanvas';
import { TitleScreen } from './components/TitleScreen';
import {
  createInitialSaveState,
  EXPANSION_TIERS,
  FURNITURE_CATALOG,
  SHOP_THEMES,
} from './data/themes';
import {
  BoardState,
  CustomerPhase,
  Direction,
  FloatingEffect,
  FloorItem,
  FlyingItem,
  FurnitureCategory,
  GameScreen,
  HeldItem,
  LiveCustomer,
  PlacedFurniture,
  PlayerChefState,
  RegularDef,
  ShopSaveState,
  ShopThemeConfig,
  ShopThemeId,
  SinkState,
  StationKind,
  StoryChapter,
  StoryModalData,
  StoveState,
  WorkspaceTab,
} from './types/game';
import { retroAudio } from './utils/sound';

const STORAGE_KEY = 'pixel_cozy_shop_overcooked_v2';

const OUTFIT_PALETTE = ['#F472B6', '#38BDF8', '#34D399', '#FBBF24', '#A78BFA', '#FB7185'];
const HAIR_PALETTE = ['#1E293B', '#78350F', '#D97706', '#475569', '#92400E', '#334155'];

interface DaySummaryInfo {
  dayFinished: number;
  earned: number;
  served: number;
  regularVisits: number;
  buyerLootText: string | null;
}

function formatClock(minutes: number): string {
  const clamped = Math.min(1260, Math.max(540, minutes));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function computeShopMetrics(save: ShopSaveState, theme: ShopThemeConfig) {
  let charm = save.reputation;
  let tipBonusPct = 0;
  let antiBurnBonusPct = 0;

  const tables: PlacedFurniture[] = [];
  const stoves: PlacedFurniture[] = [];
  const plateRacks: PlacedFurniture[] = [];

  save.placedFurniture.forEach((pf) => {
    const def = FURNITURE_CATALOG.find((c) => c.id === pf.itemId);
    if (!def) return;
    charm += def.charmBonus;
    tipBonusPct += def.tipBonusPct;
    antiBurnBonusPct += def.antiBurnBonusPct;
    if (def.stationKind === StationKind.TABLE) tables.push(pf);
    if (def.stationKind === StationKind.STOVE) stoves.push(pf);
    if (def.stationKind === StationKind.PLATE_RACK) plateRacks.push(pf);
  });

  theme.regulars.forEach((reg) => {
    const pts = save.regularPoints[reg.id] || 0;
    if (getRegularHeartLevel(pts) >= 5) {
      charm += 15;
    }
  });

  const chefStaff = theme.staffPool.find((s) => s.roleType === 'CHEF');
  const serverStaff = theme.staffPool.find((s) => s.roleType === 'SERVER');
  const hostStaff = theme.staffPool.find((s) => s.roleType === 'HOST');
  const buyerStaff = theme.staffPool.find((s) => s.roleType === 'BUYER');

  const chefLevel = chefStaff ? save.hiredStaffLevels[chefStaff.id] || 0 : 0;
  const serverLevel = serverStaff ? save.hiredStaffLevels[serverStaff.id] || 0 : 0;
  const hostLevel = hostStaff ? save.hiredStaffLevels[hostStaff.id] || 0 : 0;
  const buyerLevel = buyerStaff ? save.hiredStaffLevels[buyerStaff.id] || 0 : 0;

  tipBonusPct += hostLevel * 6;
  antiBurnBonusPct += chefLevel * 25;

  return {
    charm,
    tipBonusPct,
    antiBurnBonusPct,
    tables,
    stoves,
    maxCleanPlates: 3 + plateRacks.length * 3,
    chefLevel,
    serverLevel,
    hostLevel,
    buyerLevel,
  };
}

// Shortest-path BFS on walkable floor tiles (gy >= 1 and no placed furniture)
function findWalkPath(
  startGx: number,
  startGy: number,
  goalTiles: Array<{ gx: number; gy: number }>,
  cols: number,
  rows: number,
  blockedSet: Set<string>
): Array<{ gx: number; gy: number }> | null {
  const validGoals = goalTiles.filter(
    (g) => g.gx >= 0 && g.gx < cols && g.gy >= 1 && g.gy < rows && !blockedSet.has(`${g.gx},${g.gy}`)
  );
  if (validGoals.length === 0) return null;

  const goalKeySet = new Set(validGoals.map((g) => `${g.gx},${g.gy}`));
  if (goalKeySet.has(`${startGx},${startGy}`)) return [];

  const queue: Array<{ gx: number; gy: number; path: Array<{ gx: number; gy: number }> }> = [
    { gx: startGx, gy: startGy, path: [] },
  ];
  const visited = new Set<string>([`${startGx},${startGy}`]);

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const d of dirs) {
      const nx = cur.gx + d.dx;
      const ny = cur.gy + d.dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= cols || ny < 1 || ny >= rows) continue;
      if (visited.has(key) || blockedSet.has(key)) continue;
      const nextPath = [...cur.path, { gx: nx, gy: ny }];
      if (goalKeySet.has(key)) {
        return nextPath;
      }
      visited.add(key);
      queue.push({ gx: nx, gy: ny, path: nextPath });
    }
  }
  return null;
}

function getHeldItemLabel(held: HeldItem | null, theme: ShopThemeConfig): string {
  if (!held) return '雙手空空（可拿取食材或餐盤）';
  if (held.kind === 'RAW_INGREDIENT') {
    const ing = theme.ingredients.find((i) => i.id === held.ingId);
    return `生鮮「${ing?.name || held.ingId}」→ 請放上切菜備料台`;
  }
  if (held.kind === 'PREPPED_INGREDIENT') {
    const ing = theme.ingredients.find((i) => i.id === held.ingId);
    return `已備料「${ing?.name || held.ingId}」→ 請投入烹飪爐鍋`;
  }
  if (held.kind === 'CLEAN_PLATE') {
    return '乾淨餐盤 → 請去煮熟的爐鍋盛裝料理';
  }
  if (held.kind === 'PLATED_DISH') {
    return `熱騰騰「${held.dishName}」→ 請端給點餐客人！`;
  }
  if (held.kind === 'DIRTY_PLATE') {
    return '髒盤子 → 請放入洗碗槽清洗';
  }
  return '燒焦食物 → 請丟入廚餘桶清空';
}

export default function App() {
  const [saves, setSaves] = useState<Partial<Record<ShopThemeId, ShopSaveState>>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as Partial<Record<ShopThemeId, ShopSaveState>>;
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  });

  const [selectedTheme, setSelectedTheme] = useState<ShopThemeId>(ShopThemeId.CAT_BAKERY);
  const [screen, setScreen] = useState<GameScreen>(GameScreen.TITLE);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.SHOP_FLOOR);
  const [showGuideOnTitle, setShowGuideOnTitle] = useState<boolean>(true);

  // Overcooked Live Kitchen Runtime State
  const [player, setPlayer] = useState<PlayerChefState>({
    x: 3,
    y: 1,
    facing: 'UP',
    held: null,
    autoPath: [],
    pendingStationTarget: null,
  });
  const [boards, setBoards] = useState<Record<string, BoardState>>({});
  const [stoves, setStoves] = useState<Record<string, StoveState>>({});
  const [counters, setCounters] = useState<Record<string, HeldItem>>({});
  const [cleanPlates, setCleanPlates] = useState<number>(6);
  const [sink, setSink] = useState<SinkState>({ dirtyCount: 0, washProgress: 0 });
  const [dirtyTables, setDirtyTables] = useState<Record<string, boolean>>({});

  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [floorItems, setFloorItems] = useState<FloorItem[]>([]);
  const [combo, setCombo] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [staffAssistEnabled, setStaffAssistEnabled] = useState<boolean>(true);
  const [autoNextDay, setAutoNextDay] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Decoration Builder State
  const [furnitureFilter, setFurnitureFilter] = useState<'ALL' | FurnitureCategory>('ALL');
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string>('prep_board');
  const [isRemoveMode, setIsRemoveMode] = useState<boolean>(false);
  const [buildFeedback, setBuildFeedback] = useState<string>(
    '點選右側廚房設備或家具，點擊左側地板格即可自由擺放調整廚房動線！'
  );

  // Story & Day Summary Modals
  const [pendingStories, setPendingStories] = useState<StoryModalData[]>([]);
  const [activeStoryModal, setActiveStoryModal] = useState<StoryModalData | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummaryInfo | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const pressedKeysRef = useRef<Set<string>>(new Set());

  const activeSave = saves[selectedTheme];
  const activeTheme = SHOP_THEMES[selectedTheme];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    } catch {
      // Ignore storage quota errors
    }
  }, [saves]);

  const updateActiveSave = useCallback(
    (updater: (prev: ShopSaveState) => ShopSaveState) => {
      setSaves((prev) => {
        const current = prev[selectedTheme];
        if (!current) return prev;
        return {
          ...prev,
          [selectedTheme]: updater(current),
        };
      });
    },
    [selectedTheme]
  );

  const pushLog = useCallback((msg: string) => {
    setEventLog((prev) => [msg, ...prev.slice(0, 5)]);
  }, []);

  const spawnEffect = useCallback(
    (gx: number, gy: number, text: string, tone: FloatingEffect['tone']) => {
      const id = `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setEffects((prev) => [...prev.slice(-9), { id, gx, gy, text, tone }]);
      window.setTimeout(() => {
        setEffects((prev) => prev.filter((item) => item.id !== id));
      }, 1150);
    },
    []
  );

  const resetKitchenRuntime = useCallback((saveForPlates?: ShopSaveState) => {
    const rackCount = saveForPlates
      ? saveForPlates.placedFurniture.filter((f) => f.itemId === 'plate_rack').length
      : 1;
    setPlayer({
      x: 3,
      y: 1,
      facing: 'UP',
      held: null,
      autoPath: [],
      pendingStationTarget: null,
    });
    setBoards({});
    setStoves({});
    setCounters({});
    setCleanPlates(3 + Math.max(1, rackCount) * 3);
    setSink({ dirtyCount: 0, washProgress: 0 });
    setDirtyTables({});
    setCustomers([]);
    setEffects([]);
    setFlyingItems([]);
    setFloorItems([]);
    setCombo(0);
  }, []);

  const handleStartShop = (themeId: ShopThemeId, shopName: string) => {
    setSelectedTheme(themeId);
    let targetSave = saves[themeId];
    if (!targetSave) {
      targetSave = createInitialSaveState(themeId, shopName);
      setSaves((prev) => ({
        ...prev,
        [themeId]: targetSave,
      }));
    }
    resetKitchenRuntime(targetSave);
    setDaySummary(null);
    setIsPaused(false);
    setActiveTab(WorkspaceTab.SHOP_FLOOR);
    setScreen(GameScreen.PLAYING);
    setEventLog([
      `「${targetSave.shopName}」開張！使用 WASD 移動或點擊工作站，從上方食材箱拿原料開始烹飪吧！`,
    ]);
    retroAudio.playUnlockFanfare();
  };

  const handleResetSave = (themeId: ShopThemeId) => {
    setSaves((prev) => {
      const copy = { ...prev };
      delete copy[themeId];
      return copy;
    });
    retroAudio.playPlaceFurniture();
  };

  const handleReturnToBranches = () => {
    setScreen(GameScreen.TITLE);
    resetKitchenRuntime();
    setDaySummary(null);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    retroAudio.enabled = next;
    if (next) retroAudio.playCoin();
  };

  // Serve Dish to Seated Customer & Settle Payment + Affection!
  const serveDishToCustomer = useCallback(
    (cust: LiveCustomer) => {
      if (!activeSave) return;
      const metrics = computeShopMetrics(activeSave, activeTheme);
      const nextCombo = Math.min(10, combo + 1);
      setCombo(nextCombo);

      const earlyBirdPct = cust.patienceLeft >= 65 ? 30 : cust.patienceLeft >= 35 ? 10 : 0;
      const comboPct = nextCombo * 5;
      const totalMultiplier = 1 + (metrics.tipBonusPct + earlyBirdPct + comboPct) / 100;
      const finalGold = Math.round(cust.payAmount * totalMultiplier);

      retroAudio.playServe();
      spawnEffect(
        cust.gx,
        cust.gy,
        `+${finalGold}G · 連擊x${nextCombo}`,
        nextCombo >= 2 ? 'COMBO' : 'GOLD'
      );

      let unlockedModal: StoryModalData | null = null;
      const regDef = cust.regularId
        ? activeTheme.regulars.find((r) => r.id === cust.regularId)
        : undefined;

      updateActiveSave((prev) => {
        const nextPoints = { ...prev.regularPoints };
        const nextChapters = { ...prev.unlockedChapters };
        let extraGold = 0;
        const nextInventory = { ...prev.inventory };

        if (regDef) {
          const isFav = cust.recipeId === regDef.favoriteRecipeId;
          const gain = isFav ? 2 : 1;
          const newPts = (nextPoints[regDef.id] || 0) + gain;
          nextPoints[regDef.id] = newPts;

          const newHeartLvl = getRegularHeartLevel(newPts);
          const seen = nextChapters[regDef.id] || [];

          for (const ch of regDef.chapters) {
            if (newHeartLvl >= ch.levelRequired && !seen.includes(ch.levelRequired)) {
              seen.push(ch.levelRequired);
              nextChapters[regDef.id] = [...seen];
              extraGold += ch.rewardGold;
              if (ch.rewardIngredientId && ch.rewardIngredientQty) {
                nextInventory[ch.rewardIngredientId] =
                  (nextInventory[ch.rewardIngredientId] || 0) + ch.rewardIngredientQty;
              }
              unlockedModal = { regular: regDef, chapter: ch };
              break;
            }
          }
        }

        return {
          ...prev,
          gold: prev.gold + finalGold + extraGold,
          reputation: prev.reputation + 1,
          regularPoints: nextPoints,
          unlockedChapters: nextChapters,
          inventory: nextInventory,
          totalServed: prev.totalServed + 1,
          todayEarned: prev.todayEarned + finalGold + extraGold,
          todayServed: prev.todayServed + 1,
          todayRegularVisits: prev.todayRegularVisits + (regDef ? 1 : 0),
        };
      });

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === cust.id ? { ...c, phase: CustomerPhase.EATING, eatProgress: 0 } : c
        )
      );

      const recipe = activeTheme.recipes.find((r) => r.id === cust.recipeId);
      pushLog(
        `完美端上「${recipe?.name}」給 ${cust.name}！獲得 ${finalGold} G${earlyBirdPct >= 30 ? '（早鳥熱騰騰小費加成！）' : ''
        }`
      );

      if (unlockedModal) {
        const modalToQueue = unlockedModal;
        retroAudio.playHeartStory();
        setPendingStories((prev) => [...prev, modalToQueue]);
      }
    },
    [activeSave, activeTheme, combo, pushLog, spawnEffect, updateActiveSave]
  );

  // Core Station Interaction at Target Tile (gx, gy)
  const executeStationAction = useCallback(
    (gx: number, gy: number, mode: 'INTERACT' | 'WORK') => {
      if (!activeSave) return;

      // 0. Check Dropped Floor Item at (gx, gy)
      if (mode === 'INTERACT' && !player.held) {
        const fi = floorItems.find((f) => f.gx === gx && f.gy === gy);
        if (fi) {
          setFloorItems((prev) => prev.filter((item) => item.id !== fi.id));
          setPlayer((prev) => ({ ...prev, held: fi.item }));
          retroAudio.playPickup();
          spawnEffect(gx, gy, '撿起物品', 'COOK');
          return;
        }
      }

      // 1. Check Row 0 Ingredient Crate (gy === 0, gx 1..8)
      if (gy === 0 && gx >= 1 && gx <= 8) {
        const ing = activeTheme.ingredients[gx - 1];
        if (!ing) return;

        setPlayer((prev) => {
          if (!prev.held) {
            retroAudio.playPickup();
            spawnEffect(gx, 0, `拿取 ${ing.shortName}`, 'COOK');
            return { ...prev, held: { kind: 'RAW_INGREDIENT', ingId: ing.id } };
          }
          if (prev.held.kind === 'RAW_INGREDIENT' && prev.held.ingId === ing.id) {
            retroAudio.playPickup();
            spawnEffect(gx, 0, '放回食材箱', 'COOK');
            return { ...prev, held: null };
          }
          spawnEffect(gx, 0, '雙手已滿！', 'WARN');
          return prev;
        });
        return;
      }

      // 2. Find Placed Station / Furniture at (gx, gy)
      const pf = activeSave.placedFurniture.find((f) => f.gx === gx && f.gy === gy);
      if (!pf) {
        return;
      }
      const def = FURNITURE_CATALOG.find((c) => c.id === pf.itemId);
      if (!def) return;

      // WORK Action (F key / Chopping / Washing)
      if (mode === 'WORK') {
        if (def.stationKind === StationKind.CUTTING_BOARD) {
          const b = boards[pf.uid];
          if (b && !b.isPrepped) {
            const nextProg = Math.min(100, b.chopProgress + 36);
            const done = nextProg >= 100;
            if (done) {
              retroAudio.playPrepComplete();
              spawnEffect(gx, gy, '備料完成！', 'COMBO');
            } else {
              retroAudio.playChop();
            }
            setBoards((prev) => ({
              ...prev,
              [pf.uid]: { ...b, chopProgress: nextProg, isPrepped: done },
            }));
          } else {
            spawnEffect(gx, gy, '請先放上生鮮食材', 'WARN');
          }
          return;
        }

        if (def.stationKind === StationKind.SINK) {
          if (sink.dirtyCount > 0) {
            const nextWash = sink.washProgress + 50;
            if (nextWash >= 100) {
              retroAudio.playWash();
              setSink((prev) => ({
                dirtyCount: Math.max(0, prev.dirtyCount - 1),
                washProgress: 0,
              }));
              setCleanPlates((c) => c + 1);
              spawnEffect(gx, gy, '洗淨餐盤 +1', 'COMBO');
            } else {
              retroAudio.playWash();
              setSink((prev) => ({ ...prev, washProgress: nextWash }));
            }
          } else {
            spawnEffect(gx, gy, '水槽內沒有髒盤子', 'WARN');
          }
          return;
        }
      }

      // INTERACT Action (Space key / Pick up / Place / Plate / Serve)
      switch (def.stationKind) {
        case StationKind.CUTTING_BOARD: {
          const b = boards[pf.uid];
          if (!b && player.held?.kind === 'RAW_INGREDIENT') {
            const rawId = player.held.ingId;
            setBoards((prev) => ({
              ...prev,
              [pf.uid]: { ingId: rawId, isPrepped: false, chopProgress: 0 },
            }));
            setPlayer((prev) => ({ ...prev, held: null }));
            retroAudio.playPlaceFurniture();
            spawnEffect(gx, gy, '按 F 切菜備料', 'COOK');
          } else if (b && !b.isPrepped && !player.held) {
            // Friendly convenience: Space/Click also chops when empty-handed!
            const nextProg = Math.min(100, b.chopProgress + 36);
            const done = nextProg >= 100;
            if (done) {
              retroAudio.playPrepComplete();
              spawnEffect(gx, gy, '備料完成！', 'COMBO');
            } else {
              retroAudio.playChop();
            }
            setBoards((prev) => ({
              ...prev,
              [pf.uid]: { ...b, chopProgress: nextProg, isPrepped: done },
            }));
          } else if (b && b.isPrepped && !player.held) {
            setPlayer((prev) => ({
              ...prev,
              held: { kind: 'PREPPED_INGREDIENT', ingId: b.ingId },
            }));
            setBoards((prev) => {
              const copy = { ...prev };
              delete copy[pf.uid];
              return copy;
            });
            retroAudio.playPickup();
            spawnEffect(gx, gy, '拿起備料', 'COOK');
          } else if (b && b.isPrepped && player.held?.kind === 'RAW_INGREDIENT') {
            const incomingRaw = player.held.ingId;
            setPlayer((prev) => ({
              ...prev,
              held: { kind: 'PREPPED_INGREDIENT', ingId: b.ingId },
            }));
            setBoards((prev) => ({
              ...prev,
              [pf.uid]: { ingId: incomingRaw, isPrepped: false, chopProgress: 0 },
            }));
            retroAudio.playPickup();
          } else if (!b && player.held && player.held.kind !== 'RAW_INGREDIENT') {
            spawnEffect(gx, gy, '備料台只能放生食材！', 'WARN');
          }
          break;
        }

        case StationKind.STOVE: {
          const st: StoveState = stoves[pf.uid] || {
            ingredients: [],
            status: 'EMPTY',
            cookProgress: 0,
            burnProgress: 0,
          };

          if (player.held?.kind === 'PREPPED_INGREDIENT') {
            if (st.status === 'BURNT') {
              spawnEffect(gx, gy, '焦鍋請先空手清理！', 'WARN');
              return;
            }
            if (st.ingredients.length >= 3) {
              spawnEffect(gx, gy, '鍋內已滿 3 種食材！', 'WARN');
              return;
            }
            const addedIng = player.held.ingId;
            const nextIngs = [...st.ingredients, addedIng];
            setStoves((prev) => ({
              ...prev,
              [pf.uid]: {
                ingredients: nextIngs,
                status: 'COOKING',
                cookProgress: st.ingredients.length === 0 ? 0 : Math.min(st.cookProgress, 55),
                burnProgress: 0,
              },
            }));
            setPlayer((prev) => ({ ...prev, held: null }));
            retroAudio.playCookTap();
            spawnEffect(gx, gy, `投入爐鍋 (${nextIngs.length}/3)`, 'COOK');
          } else if (player.held?.kind === 'RAW_INGREDIENT') {
            spawnEffect(gx, gy, '生食材需先去切菜台備料！', 'WARN');
          } else if (st.status === 'COOKED') {
            if (player.held?.kind === 'CLEAN_PLATE') {
              const comboKey = [...st.ingredients].sort().join('+');
              const matched = activeTheme.recipes.find(
                (r) => [...r.ingredients].sort().join('+') === comboKey
              );

              if (matched && !activeSave.unlockedRecipes.includes(matched.id)) {
                updateActiveSave((prev) => ({
                  ...prev,
                  reputation: prev.reputation + matched.charmGain,
                  unlockedRecipes: [...prev.unlockedRecipes, matched.id],
                  recipeLevels: { ...prev.recipeLevels, [matched.id]: 1 },
                }));
                retroAudio.playUnlockFanfare();
                pushLog(`驚喜發現！在廚房實戰煮出了新食譜「${matched.name}」！`);
              } else {
                retroAudio.playPickup();
              }

              const dishItem: HeldItem = matched
                ? {
                  kind: 'PLATED_DISH',
                  recipeId: matched.id,
                  dishName: matched.name,
                  spriteKey: matched.spriteKey,
                }
                : {
                  kind: 'PLATED_DISH',
                  recipeId: null,
                  dishName: '什錦試作料理',
                  spriteKey: 'DISH_ROLL',
                };

              setPlayer((prev) => ({ ...prev, held: dishItem }));
              setStoves((prev) => ({
                ...prev,
                [pf.uid]: {
                  ingredients: [],
                  status: 'EMPTY',
                  cookProgress: 0,
                  burnProgress: 0,
                },
              }));
              spawnEffect(gx, gy, matched ? `盛裝：${matched.name}` : '不明組合料理', 'COMBO');
            } else {
              spawnEffect(gx, gy, '請拿乾淨餐盤來盛裝！', 'WARN');
            }
          } else if (st.status === 'BURNT') {
            if (!player.held) {
              setPlayer((prev) => ({ ...prev, held: { kind: 'BURNT_FOOD' } }));
              setStoves((prev) => ({
                ...prev,
                [pf.uid]: {
                  ingredients: [],
                  status: 'EMPTY',
                  cookProgress: 0,
                  burnProgress: 0,
                },
              }));
              retroAudio.playPickup();
              spawnEffect(gx, gy, '請丟進廚餘桶！', 'WARN');
            } else {
              spawnEffect(gx, gy, '請先空手清理燒焦鍋子！', 'WARN');
            }
          } else if (st.status === 'COOKING') {
            spawnEffect(gx, gy, `烹煮中 ${Math.round(st.cookProgress)}%`, 'COOK');
          }
          break;
        }

        case StationKind.COUNTER: {
          const onCounter = counters[pf.uid];
          if (!onCounter && player.held) {
            const itemToPlace = player.held;
            setCounters((prev) => ({ ...prev, [pf.uid]: itemToPlace }));
            setPlayer((prev) => ({ ...prev, held: null }));
            retroAudio.playPlaceFurniture();
          } else if (onCounter && !player.held) {
            setPlayer((prev) => ({ ...prev, held: onCounter }));
            setCounters((prev) => {
              const copy = { ...prev };
              delete copy[pf.uid];
              return copy;
            });
            retroAudio.playPickup();
          } else if (onCounter && player.held) {
            const fromHand = player.held;
            setPlayer((prev) => ({ ...prev, held: onCounter }));
            setCounters((prev) => ({ ...prev, [pf.uid]: fromHand }));
            retroAudio.playPickup();
          }
          break;
        }

        case StationKind.PLATE_RACK: {
          if (!player.held) {
            if (cleanPlates > 0) {
              setCleanPlates((c) => c - 1);
              setPlayer((prev) => ({ ...prev, held: { kind: 'CLEAN_PLATE' } }));
              retroAudio.playPickup();
              spawnEffect(gx, gy, '拿取乾淨餐盤', 'COOK');
            } else {
              spawnEffect(gx, gy, '無乾淨盤子！快收髒盤去洗', 'WARN');
            }
          } else if (player.held.kind === 'CLEAN_PLATE') {
            setCleanPlates((c) => c + 1);
            setPlayer((prev) => ({ ...prev, held: null }));
            retroAudio.playPlaceFurniture();
          }
          break;
        }

        case StationKind.SINK: {
          if (player.held?.kind === 'DIRTY_PLATE') {
            setSink((prev) => ({ ...prev, dirtyCount: prev.dirtyCount + 1 }));
            setPlayer((prev) => ({ ...prev, held: null }));
            retroAudio.playPlaceFurniture();
            spawnEffect(gx, gy, '按 F 清洗髒盤子', 'COOK');
          } else if (sink.dirtyCount > 0) {
            const nextWash = sink.washProgress + 50;
            if (nextWash >= 100) {
              retroAudio.playWash();
              setSink((prev) => ({
                dirtyCount: Math.max(0, prev.dirtyCount - 1),
                washProgress: 0,
              }));
              setCleanPlates((c) => c + 1);
              spawnEffect(gx, gy, '洗淨餐盤 +1', 'COMBO');
            } else {
              retroAudio.playWash();
              setSink((prev) => ({ ...prev, washProgress: nextWash }));
            }
          }
          break;
        }

        case StationKind.TRASH_BIN: {
          if (!player.held) return;
          if (player.held.kind === 'CLEAN_PLATE' || player.held.kind === 'DIRTY_PLATE') {
            spawnEffect(gx, gy, '餐盤不能丟進廚餘桶！', 'WARN');
            return;
          }
          if (player.held.kind === 'PLATED_DISH') {
            setPlayer((prev) => ({ ...prev, held: { kind: 'CLEAN_PLATE' } }));
            retroAudio.playPlaceFurniture();
            spawnEffect(gx, gy, '倒掉失敗菜（保留餐盤）', 'COOK');
            return;
          }
          setPlayer((prev) => ({ ...prev, held: null }));
          retroAudio.playPlaceFurniture();
          spawnEffect(gx, gy, '已丟棄食材', 'COOK');
          break;
        }

        case StationKind.TABLE: {
          const seated = customers.find((c) => c.tableUid === pf.uid);
          if (
            seated &&
            seated.phase === CustomerPhase.WAITING_FOOD &&
            player.held?.kind === 'PLATED_DISH'
          ) {
            if (player.held.recipeId === seated.recipeId) {
              setPlayer((prev) => ({ ...prev, held: null }));
              serveDishToCustomer(seated);
            } else {
              const want = activeTheme.recipes.find((r) => r.id === seated.recipeId);
              spawnEffect(gx, gy, `客人點的是${want?.name}！`, 'WARN');
            }
            return;
          }

          if (dirtyTables[pf.uid] && !player.held) {
            setDirtyTables((prev) => {
              const copy = { ...prev };
              delete copy[pf.uid];
              return copy;
            });
            setPlayer((prev) => ({ ...prev, held: { kind: 'DIRTY_PLATE' } }));
            retroAudio.playPickup();
            spawnEffect(gx, gy, '收起髒盤子', 'COOK');
            return;
          }

          if (dirtyTables[pf.uid] && player.held) {
            spawnEffect(gx, gy, '請先空手收走髒盤子！', 'WARN');
          }
          break;
        }

        default:
          break;
      }
    },
    [
      activeSave,
      activeTheme,
      boards,
      cleanPlates,
      counters,
      customers,
      dirtyTables,
      floorItems,
      player.held,
      pushLog,
      serveDishToCustomer,
      sink,
      spawnEffect,
      stoves,
      updateActiveSave,
    ]
  );

  // Trigger action on tile directly in front of player chef
  const handleManualInteract = useCallback(() => {
    const rx = Math.round(player.x);
    const ry = Math.round(player.y);
    const front = getFrontTile(player);

    if (!player.held) {
      const fi =
        floorItems.find((f) => f.gx === front.gx && f.gy === front.gy) ||
        floorItems.find((f) => f.gx === rx && f.gy === ry);
      if (fi) {
        setFloorItems((prev) => prev.filter((item) => item.id !== fi.id));
        setPlayer((prev) => ({ ...prev, held: fi.item }));
        retroAudio.playPickup();
        spawnEffect(fi.gx, fi.gy, '撿起物品', 'COOK');
        return;
      }
    }

    executeStationAction(front.gx, front.gy, 'INTERACT');
  }, [executeStationAction, floorItems, player]);

  const handleManualWork = useCallback(() => {
    const front = getFrontTile(player);
    executeStationAction(front.gx, front.gy, 'WORK');
  }, [executeStationAction, player]);

  // Click-to-Walk & Auto-Interact on SVG Kitchen Map
  const handlePlayTileClick = useCallback(
    (gx: number, gy: number, mode: 'INTERACT' | 'WORK') => {
      if (!activeSave) return;
      const tier =
        EXPANSION_TIERS.find((t) => t.level === activeSave.expansionLevel) || EXPANSION_TIERS[0];
      const blocked = new Set(activeSave.placedFurniture.map((f) => `${f.gx},${f.gy}`));

      const startGx = Math.round(player.x);
      const startGy = Math.round(player.y);

      const isTargetStation = gy === 0 || blocked.has(`${gx},${gy}`);

      if (!isTargetStation) {
        // Walk directly onto clicked floor tile
        const path = findWalkPath(startGx, startGy, [{ gx, gy }], tier.cols, tier.rows, blocked);
        if (path) {
          setPlayer((prev) => ({
            ...prev,
            autoPath: path,
            pendingStationTarget: null,
          }));
        }
        return;
      }

      // If already orthogonally adjacent to station, face it & act immediately!
      if (Math.abs(startGx - gx) + Math.abs(startGy - gy) === 1) {
        const dir: Direction =
          gx < startGx ? 'LEFT' : gx > startGx ? 'RIGHT' : gy < startGy ? 'UP' : 'DOWN';
        setPlayer((prev) => ({
          ...prev,
          x: startGx,
          y: startGy,
          facing: dir,
          autoPath: [],
          pendingStationTarget: null,
        }));
        executeStationAction(gx, gy, mode);
        return;
      }

      // Otherwise find path to closest orthogonal walkable neighbor
      const neighbors = [
        { gx, gy: gy + 1 },
        { gx, gy: gy - 1 },
        { gx: gx - 1, gy },
        { gx: gx + 1, gy },
      ];
      const path = findWalkPath(startGx, startGy, neighbors, tier.cols, tier.rows, blocked);
      if (path) {
        setPlayer((prev) => ({
          ...prev,
          autoPath: path,
          pendingStationTarget: { gx, gy, mode },
        }));
      } else {
        spawnEffect(gx, gy, '動線被擋住了！', 'WARN');
      }
    },
    [activeSave, executeStationAction, player.x, player.y, spawnEffect]
  );

  // D-Pad Step Move for Mobile / Touch Buttons
  const handleManualMoveStep = (dir: Direction) => {
    if (!activeSave) return;
    const tier =
      EXPANSION_TIERS.find((t) => t.level === activeSave.expansionLevel) || EXPANSION_TIERS[0];
    const blocked = new Set(activeSave.placedFurniture.map((f) => `${f.gx},${f.gy}`));

    setPlayer((prev) => {
      const rx = Math.round(prev.x);
      const ry = Math.round(prev.y);
      const nx = dir === 'LEFT' ? rx - 1 : dir === 'RIGHT' ? rx + 1 : rx;
      const ny = dir === 'UP' ? ry - 1 : dir === 'DOWN' ? ry + 1 : ry;

      if (nx >= 0 && nx < tier.cols && ny >= 1 && ny < tier.rows && !blocked.has(`${nx},${ny}`)) {
        return {
          ...prev,
          x: nx,
          y: ny,
          facing: dir,
          autoPath: [],
          pendingStationTarget: null,
        };
      }
      return { ...prev, facing: dir, autoPath: [], pendingStationTarget: null };
    });
  };

  // Flying Item Landing Logic
  const handleFlyingItemLanding = useCallback(
    (flying: FlyingItem) => {
      const { targetX, targetY, targetAction, targetStationUid, item } = flying;

      if (targetAction === 'STOVE_ADD' && targetStationUid && item.kind === 'PREPPED_INGREDIENT') {
        let added = false;
        setStoves((prev) => {
          const st = prev[targetStationUid] || {
            ingredients: [],
            status: 'EMPTY',
            cookProgress: 0,
            burnProgress: 0,
          };
          if (st.status === 'BURNT' || st.ingredients.length >= 3) {
            return prev;
          }
          added = true;
          const nextIngs = [...st.ingredients, item.ingId];
          return {
            ...prev,
            [targetStationUid]: {
              ingredients: nextIngs,
              status: 'COOKING',
              cookProgress: st.ingredients.length === 0 ? 0 : Math.min(st.cookProgress, 55),
              burnProgress: 0,
            },
          };
        });

        if (added) {
          retroAudio.playCookTap();
          spawnEffect(targetX, targetY, '🎯 空投進鍋！', 'COOK');
        } else {
          retroAudio.playItemLand();
          setFloorItems((prev) => [
            ...prev,
            {
              id: `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              gx: targetX,
              gy: targetY,
              item,
            },
          ]);
          spawnEffect(targetX, targetY, '鍋滿掉落', 'WARN');
        }
        return;
      }

      if (targetAction === 'BOARD_PLACE' && targetStationUid && item.kind === 'RAW_INGREDIENT') {
        let placed = false;
        setBoards((prev) => {
          if (prev[targetStationUid]) return prev;
          placed = true;
          return {
            ...prev,
            [targetStationUid]: { ingId: item.ingId, isPrepped: false, chopProgress: 0 },
          };
        });

        if (placed) {
          retroAudio.playPlaceFurniture();
          spawnEffect(targetX, targetY, '🎯 空投上砧板', 'COOK');
        } else {
          retroAudio.playItemLand();
          setFloorItems((prev) => [
            ...prev,
            {
              id: `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              gx: targetX,
              gy: targetY,
              item,
            },
          ]);
          spawnEffect(targetX, targetY, '砧板已滿', 'WARN');
        }
        return;
      }

      if (targetAction === 'COUNTER_PLACE' && targetStationUid) {
        let placed = false;
        setCounters((prev) => {
          if (prev[targetStationUid]) return prev;
          placed = true;
          return { ...prev, [targetStationUid]: item };
        });

        if (placed) {
          retroAudio.playPlaceFurniture();
          spawnEffect(targetX, targetY, '🎯 投至流理台', 'COOK');
        } else {
          retroAudio.playItemLand();
          setFloorItems((prev) => [
            ...prev,
            {
              id: `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              gx: targetX,
              gy: targetY,
              item,
            },
          ]);
          spawnEffect(targetX, targetY, '流理台已滿', 'WARN');
        }
        return;
      }

      if (targetAction === 'TRASH') {
        retroAudio.playPlaceFurniture();
        spawnEffect(targetX, targetY, '🗑️ 投進垃圾桶！', 'COOK');
        return;
      }

      // Default: Land on floor
      retroAudio.playItemLand();
      setFloorItems((prev) => [
        ...prev,
        {
          id: `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          gx: targetX,
          gy: targetY,
          item,
        },
      ]);
      spawnEffect(targetX, targetY, '掉在地上', 'WARN');
    },
    [spawnEffect]
  );

  // Flying Item Animation Loop
  useEffect(() => {
    if (flyingItems.length === 0) return;

    const timer = window.setInterval(() => {
      setFlyingItems((prev) => {
        if (prev.length === 0) return prev;
        const remaining: FlyingItem[] = [];
        for (const fItem of prev) {
          const nextProg = fItem.progress + 0.18;
          if (nextProg >= 1) {
            handleFlyingItemLanding(fItem);
          } else {
            remaining.push({ ...fItem, progress: nextProg });
          }
        }
        return remaining;
      });
    }, 28);

    return () => window.clearInterval(timer);
  }, [flyingItems.length, handleFlyingItemLanding]);

  // Throw Item Action (Q Key / Throw Button)
  const handleManualThrow = useCallback(() => {
    if (
      !player.held ||
      screen !== GameScreen.PLAYING ||
      activeTab !== WorkspaceTab.SHOP_FLOOR ||
      isPaused ||
      daySummary ||
      activeStoryModal
    ) {
      return;
    }

    const tier =
      EXPANSION_TIERS.find((t) => t.level === activeSave?.expansionLevel) || EXPANSION_TIERS[0];
    const maxCols = tier.cols;
    const maxRows = tier.rows;

    let dx = 0;
    let dy = 0;
    if (player.facing === 'UP') dy = -1;
    else if (player.facing === 'DOWN') dy = 1;
    else if (player.facing === 'LEFT') dx = -1;
    else if (player.facing === 'RIGHT') dx = 1;

    const startX = Math.round(player.x);
    const startY = Math.round(player.y);
    const held = player.held;

    let targetX = startX;
    let targetY = startY;
    let targetAction: FlyingItem['targetAction'] = 'FLOOR';
    let targetStationUid: string | undefined = undefined;
    let targetStationKind: StationKind | undefined = undefined;

    const maxDistance = 4;
    let landed = false;

    for (let dist = 1; dist <= maxDistance; dist++) {
      const tx = startX + dx * dist;
      const ty = startY + dy * dist;

      // Check boundary (row 0 is wall with ingredient boxes)
      if (tx < 0 || tx >= maxCols || ty < 1 || ty >= maxRows) {
        targetX = dist > 1 ? startX + dx * (dist - 1) : startX;
        targetY = dist > 1 ? startY + dy * (dist - 1) : startY;
        targetAction = 'FLOOR';
        landed = true;
        break;
      }

      // Check if there is furniture at (tx, ty)
      const pf = activeSave?.placedFurniture.find((f) => f.gx === tx && f.gy === ty);
      if (pf) {
        const def = FURNITURE_CATALOG.find((c) => c.id === pf.itemId);
        if (def) {
          // 1. Stove: prepped ingredients can fly straight into pot!
          if (def.stationKind === StationKind.STOVE && held.kind === 'PREPPED_INGREDIENT') {
            const st = stoves[pf.uid] || { ingredients: [], status: 'EMPTY' };
            if (st.status !== 'BURNT' && st.ingredients.length < 3) {
              targetX = tx;
              targetY = ty;
              targetAction = 'STOVE_ADD';
              targetStationUid = pf.uid;
              targetStationKind = StationKind.STOVE;
              landed = true;
              break;
            }
          }

          // 2. Cutting board: raw ingredient flies onto empty board!
          if (def.stationKind === StationKind.CUTTING_BOARD && held.kind === 'RAW_INGREDIENT') {
            if (!boards[pf.uid]) {
              targetX = tx;
              targetY = ty;
              targetAction = 'BOARD_PLACE';
              targetStationUid = pf.uid;
              targetStationKind = StationKind.CUTTING_BOARD;
              landed = true;
              break;
            }
          }

          // 3. Counter: any item flies onto empty counter!
          if (def.stationKind === StationKind.COUNTER && !counters[pf.uid]) {
            targetX = tx;
            targetY = ty;
            targetAction = 'COUNTER_PLACE';
            targetStationUid = pf.uid;
            targetStationKind = StationKind.COUNTER;
            landed = true;
            break;
          }

          // 4. Trash bin: throw food/ingredients into trash
          if (def.stationKind === StationKind.TRASH_BIN) {
            if (held.kind !== 'CLEAN_PLATE' && held.kind !== 'DIRTY_PLATE') {
              targetX = tx;
              targetY = ty;
              targetAction = 'TRASH';
              targetStationUid = pf.uid;
              targetStationKind = StationKind.TRASH_BIN;
              landed = true;
              break;
            }
          }
        }

        // Blocked by furniture: stop at previous tile
        targetX = dist > 1 ? startX + dx * (dist - 1) : startX;
        targetY = dist > 1 ? startY + dy * (dist - 1) : startY;
        targetAction = 'FLOOR';
        landed = true;
        break;
      }

      // Reached max open distance
      if (dist === maxDistance) {
        targetX = tx;
        targetY = ty;
        targetAction = 'FLOOR';
        landed = true;
        break;
      }
    }

    if (!landed) {
      targetX = startX;
      targetY = startY;
      targetAction = 'FLOOR';
    }

    retroAudio.playThrow();
    setPlayer((prev) => ({ ...prev, held: null }));

    const flyingId = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFlyingItems((prev) => [
      ...prev,
      {
        id: flyingId,
        item: held,
        startX: player.x,
        startY: player.y,
        targetX,
        targetY,
        progress: 0,
        targetStationUid,
        targetStationKind,
        targetAction,
      },
    ]);
  }, [
    activeSave,
    activeStoryModal,
    activeTab,
    boards,
    counters,
    daySummary,
    isPaused,
    player,
    screen,
    stoves,
  ]);

  // Global Keyboard Listeners (WASD / Arrows + Space/E + F/C + Q)
  const actionHandlersRef = useRef({
    interact: handleManualInteract,
    work: handleManualWork,
    throwItem: handleManualThrow,
  });

  useEffect(() => {
    actionHandlersRef.current = {
      interact: handleManualInteract,
      work: handleManualWork,
      throwItem: handleManualThrow,
    };
  }, [handleManualInteract, handleManualWork, handleManualThrow]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const code = e.code;
      if (
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
        pressedKeysRef.current.add(code);
      } else if (code === 'Space' || code === 'KeyE') {
        e.preventDefault();
        actionHandlersRef.current.interact();
      } else if (code === 'KeyF' || code === 'KeyC') {
        e.preventDefault();
        actionHandlersRef.current.work();
      } else if (code === 'KeyQ') {
        e.preventDefault();
        actionHandlersRef.current.throwItem();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Fast 55ms Player Movement & Auto-Path Loop
  const moveContextRef = useRef({
    save: activeSave,
    executeStationAction,
    screen,
    activeTab,
    isPaused,
    daySummary,
    activeStoryModal,
  });

  useEffect(() => {
    moveContextRef.current = {
      save: activeSave,
      executeStationAction,
      screen,
      activeTab,
      isPaused,
      daySummary,
      activeStoryModal,
    };
  }, [activeSave, executeStationAction, screen, activeTab, isPaused, daySummary, activeStoryModal]);

  useEffect(() => {
    if (screen !== GameScreen.PLAYING) return;

    const timer = window.setInterval(() => {
      const ctx = moveContextRef.current;
      if (
        !ctx.save ||
        ctx.activeTab !== WorkspaceTab.SHOP_FLOOR ||
        ctx.isPaused ||
        ctx.daySummary ||
        ctx.activeStoryModal
      ) {
        return;
      }

      const tier =
        EXPANSION_TIERS.find((t) => t.level === ctx.save!.expansionLevel) || EXPANSION_TIERS[0];
      const blocked = new Set(ctx.save.placedFurniture.map((f) => `${f.gx},${f.gy}`));
      const keys = pressedKeysRef.current;

      let dx = 0;
      let dy = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const step = dx !== 0 && dy !== 0 ? 0.19 : 0.26;
        const newFacing: Direction =
          Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'LEFT' : 'RIGHT') : dy < 0 ? 'UP' : 'DOWN';

        setPlayer((prev) => {
          const canStand = (cx: number, cy: number) => {
            const rx = Math.round(cx);
            const ry = Math.round(cy);
            if (cx < 0 || cx > tier.cols - 1 || cy < 1 || cy > tier.rows - 1) return false;
            return !blocked.has(`${rx},${ry}`);
          };

          let nx = prev.x;
          let ny = prev.y;
          if (dx !== 0 && canStand(prev.x + dx * step, prev.y)) {
            nx = prev.x + dx * step;
          }
          if (dy !== 0 && canStand(nx, prev.y + dy * step)) {
            ny = prev.y + dy * step;
          }

          return {
            ...prev,
            x: nx,
            y: ny,
            facing: newFacing,
            autoPath: [],
            pendingStationTarget: null,
          };
        });
        return;
      }

      // Follow click-to-walk autoPath if active
      setPlayer((prev) => {
        if (prev.autoPath.length === 0) {
          if (prev.pendingStationTarget) {
            const tgt = prev.pendingStationTarget;
            const rx = Math.round(prev.x);
            const ry = Math.round(prev.y);
            const dir: Direction =
              tgt.gx < rx ? 'LEFT' : tgt.gx > rx ? 'RIGHT' : tgt.gy < ry ? 'UP' : 'DOWN';
            window.setTimeout(() => {
              moveContextRef.current.executeStationAction(tgt.gx, tgt.gy, tgt.mode);
            }, 0);
            return {
              ...prev,
              x: rx,
              y: ry,
              facing: dir,
              pendingStationTarget: null,
            };
          }
          return prev;
        }

        const nextNode = prev.autoPath[0];
        const diffX = nextNode.gx - prev.x;
        const diffY = nextNode.gy - prev.y;
        const dist = Math.hypot(diffX, diffY);
        const speed = 0.34;

        const dir: Direction =
          Math.abs(diffX) >= Math.abs(diffY)
            ? diffX < 0
              ? 'LEFT'
              : 'RIGHT'
            : diffY < 0
              ? 'UP'
              : 'DOWN';

        if (dist <= speed) {
          const rest = prev.autoPath.slice(1);
          return {
            ...prev,
            x: nextNode.gx,
            y: nextNode.gy,
            facing: dir,
            autoPath: rest,
          };
        }

        return {
          ...prev,
          x: prev.x + (diffX / dist) * speed,
          y: prev.y + (diffY / dist) * speed,
          facing: dir,
        };
      });
    }, 55);

    return () => window.clearInterval(timer);
  }, [screen]);

  // 250ms Kitchen Cooking, Burn Gauge, Staff Assist & Customer Simulation Loop
  const simRef = useRef({
    save: activeSave,
    theme: activeTheme,
    boards,
    stoves,
    sink,
    dirtyTables,
    customers,
    isPaused,
    staffAssistEnabled,
    autoNextDay,
    daySummary,
    activeStoryModal,
  });

  useEffect(() => {
    simRef.current = {
      save: activeSave,
      theme: activeTheme,
      boards,
      stoves,
      sink,
      dirtyTables,
      customers,
      isPaused,
      staffAssistEnabled,
      autoNextDay,
      daySummary,
      activeStoryModal,
    };
  }, [
    activeSave,
    activeTheme,
    boards,
    stoves,
    sink,
    dirtyTables,
    customers,
    isPaused,
    staffAssistEnabled,
    autoNextDay,
    daySummary,
    activeStoryModal,
  ]);

  useEffect(() => {
    if (screen !== GameScreen.PLAYING) return;

    const timer = window.setInterval(() => {
      const cur = simRef.current;
      if (!cur.save || cur.isPaused || cur.daySummary || cur.activeStoryModal) return;

      const save = cur.save;
      const theme = cur.theme;
      const metrics = computeShopMetrics(save, theme);
      const tier = EXPANSION_TIERS.find((t) => t.level === save.expansionLevel) || EXPANSION_TIERS[0];

      // 1. Advance Clock (+2 in-game minutes per 250ms = ~90s full shift)
      const nextMinute = save.minuteOfDay + 2;
      if (nextMinute >= 1260) {
        let buyerLootText: string | null = null;
        const bonusInv: Record<string, number> = {};
        if (metrics.buyerLevel > 0) {
          const dropCount = metrics.buyerLevel + 1;
          const pool = theme.ingredients;
          const names: string[] = [];
          for (let i = 0; i < dropCount; i++) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            bonusInv[pick.id] = (bonusInv[pick.id] || 0) + 1;
            names.push(pick.shortName);
          }
          buyerLootText = `採購員帶回研發食材：${names.join('、')}`;
        }

        const totalDayGold = save.todayEarned;
        const totalDayServed = save.todayServed;
        const totalDayReg = save.todayRegularVisits;

        resetKitchenRuntime(save);

        if (cur.autoNextDay) {
          updateActiveSave((prev) => {
            const mergedInv = { ...prev.inventory };
            Object.entries(bonusInv).forEach(([k, v]) => {
              mergedInv[k] = (mergedInv[k] || 0) + v;
            });
            return {
              ...prev,
              day: prev.day + 1,
              minuteOfDay: 540,
              inventory: mergedInv,
              todayEarned: 0,
              todayServed: 0,
              todayRegularVisits: 0,
            };
          });
          pushLog(`第 ${save.day} 天打烊！營收 ${totalDayGold} G，自動迎接第 ${save.day + 1} 天！`);
        } else {
          updateActiveSave((prev) => {
            const mergedInv = { ...prev.inventory };
            Object.entries(bonusInv).forEach(([k, v]) => {
              mergedInv[k] = (mergedInv[k] || 0) + v;
            });
            return {
              ...prev,
              minuteOfDay: 1260,
              inventory: mergedInv,
            };
          });
          setDaySummary({
            dayFinished: save.day,
            earned: totalDayGold,
            served: totalDayServed,
            regularVisits: totalDayReg,
            buyerLootText,
          });
        }
        return;
      }

      updateActiveSave((prev) => ({ ...prev, minuteOfDay: nextMinute }));

      // 2. Progress Stoves (Cooking + Overcook Anti-Burn Gauge!)
      const burnSlowdown = 1 + metrics.antiBurnBonusPct / 100;
      setStoves((prev) => {
        let changed = false;
        const nextStoves: Record<string, StoveState> = { ...prev };

        Object.entries(prev).forEach(([uid, st]) => {
          if (st.status === 'COOKING') {
            changed = true;
            const step = 7.2; // ~3.5 seconds to cook
            const nextCook = Math.min(100, st.cookProgress + step);
            if (nextCook >= 100) {
              retroAudio.playPrepComplete();
              nextStoves[uid] = { ...st, status: 'COOKED', cookProgress: 100, burnProgress: 0 };
            } else {
              nextStoves[uid] = { ...st, cookProgress: nextCook };
            }
          } else if (st.status === 'COOKED') {
            changed = true;
            const burnStep = 2.6 / burnSlowdown; // ~9.5s base anti-burn window!
            const nextBurn = Math.min(100, st.burnProgress + burnStep);

            if (
              (st.burnProgress < 55 && nextBurn >= 55) ||
              (st.burnProgress < 80 && nextBurn >= 80)
            ) {
              retroAudio.playBurnWarn();
            }

            if (nextBurn >= 100) {
              retroAudio.playBurnRuined();
              const pf = save.placedFurniture.find((f) => f.uid === uid);
              if (pf) spawnEffect(pf.gx, pf.gy, '煮過頭燒焦了！', 'WARN');
              nextStoves[uid] = { ...st, status: 'BURNT', burnProgress: 100 };
            } else {
              nextStoves[uid] = { ...st, burnProgress: nextBurn };
            }
          }
        });

        return changed ? nextStoves : prev;
      });

      // 3. Optional Staff Assistance (Chef chops items on boards; Server clears & washes dirty plates)
      if (cur.staffAssistEnabled) {
        if (metrics.chefLevel > 0) {
          setBoards((prev) => {
            let changed = false;
            const copy = { ...prev };
            Object.entries(prev).forEach(([uid, b]) => {
              if (!b.isPrepped) {
                changed = true;
                const np = Math.min(100, b.chopProgress + 9 * metrics.chefLevel);
                copy[uid] = { ...b, chopProgress: np, isPrepped: np >= 100 };
              }
            });
            return changed ? copy : prev;
          });
        }

        if (metrics.serverLevel > 0) {
          // Server picks up dirty plates from tables and washes sink
          const dirtyEntry = Object.keys(cur.dirtyTables)[0];
          if (dirtyEntry && Math.random() < 0.25 * metrics.serverLevel) {
            setDirtyTables((prev) => {
              const copy = { ...prev };
              delete copy[dirtyEntry];
              return copy;
            });
            setSink((prev) => ({ ...prev, dirtyCount: prev.dirtyCount + 1 }));
          } else if (cur.sink.dirtyCount > 0) {
            setSink((prev) => {
              const nw = prev.washProgress + 16 * metrics.serverLevel;
              if (nw >= 100) {
                setCleanPlates((c) => c + 1);
                return { dirtyCount: Math.max(0, prev.dirtyCount - 1), washProgress: 0 };
              }
              return { ...prev, washProgress: nw };
            });
          }
        }
      }

      // 4. Update Customers (Walk in, Wait Patience, Eat & Leave Dirty Plate)
      let nextCustomers = [...cur.customers];
      const newlyDirtiedTables: string[] = [];

      nextCustomers = nextCustomers
        .map((cust) => {
          if (cust.phase === CustomerPhase.ENTERING) {
            const dx = Math.sign(cust.targetGx - cust.gx);
            const dy = Math.sign(cust.targetGy - cust.gy);
            const nx = cust.gx + dx;
            const ny = cust.gy + dy;
            if (nx === cust.targetGx && ny === cust.targetGy) {
              return { ...cust, gx: nx, gy: ny, phase: CustomerPhase.WAITING_FOOD };
            }
            return { ...cust, gx: nx, gy: ny };
          }

          if (cust.phase === CustomerPhase.WAITING_FOOD) {
            const drain = 100 / (cust.maxWaitSeconds * 4); // 4 ticks per sec
            const nextPat = cust.patienceLeft - drain;
            if (nextPat <= 0) {
              setCombo(0);
              spawnEffect(cust.gx, cust.gy, '久候離開...', 'WARN');
              pushLog(`${cust.name}等得肚子太餓先離開了，記得注意票券倒數喔！`);
              return null;
            }
            return { ...cust, patienceLeft: nextPat };
          }

          if (cust.phase === CustomerPhase.EATING) {
            const nextEat = cust.eatProgress + 9;
            if (nextEat >= 100) {
              newlyDirtiedTables.push(cust.tableUid);
              return null;
            }
            return { ...cust, eatProgress: nextEat };
          }

          return cust;
        })
        .filter((c): c is LiveCustomer => c !== null);

      if (newlyDirtiedTables.length > 0) {
        setDirtyTables((prev) => {
          const copy = { ...prev };
          newlyDirtiedTables.forEach((tUid) => {
            copy[tUid] = true;
          });
          return copy;
        });
      }

      // 5. Spawn New Customers at Clean Free Tables
      const freeCleanTables = metrics.tables.filter(
        (tbl) =>
          !nextCustomers.some((c) => c.tableUid === tbl.uid) &&
          !cur.dirtyTables[tbl.uid] &&
          !newlyDirtiedTables.includes(tbl.uid)
      );

      if (
        freeCleanTables.length > 0 &&
        nextCustomers.length < tier.maxCustomers &&
        nextMinute < 1210
      ) {
        const spawnProb = nextCustomers.length === 0 ? 0.55 : 0.14 + metrics.charm * 0.0015;
        if (Math.random() < spawnProb) {
          const chosenTable =
            freeCleanTables[Math.floor(Math.random() * freeCleanTables.length)];
          const unlockedPool = theme.recipes.filter((r) =>
            save.unlockedRecipes.includes(r.id)
          );

          const activeRegIds = new Set(
            nextCustomers.map((c) => c.regularId).filter(Boolean)
          );
          const availRegs = theme.regulars.filter((r) => !activeRegIds.has(r.id));
          const isRegular = availRegs.length > 0 && Math.random() < 0.34;

          let chosenRegular: RegularDef | undefined;
          let chosenRecipe = unlockedPool[Math.floor(Math.random() * unlockedPool.length)];

          const featured = unlockedPool.find((r) => r.id === save.featuredRecipeId);
          if (featured && Math.random() < 0.4) {
            chosenRecipe = featured;
          }

          if (isRegular) {
            chosenRegular = availRegs[Math.floor(Math.random() * availRegs.length)];
            const fav = unlockedPool.find((r) => r.id === chosenRegular?.favoriteRecipeId);
            if (fav && Math.random() < 0.72) {
              chosenRecipe = fav;
            }
          }

          const lvl = save.recipeLevels[chosenRecipe.id] || 1;
          const baseWithLvl = Math.round(chosenRecipe.basePrice * (1 + (lvl - 1) * 0.22));
          const payAmount =
            chosenRecipe.id === save.featuredRecipeId
              ? Math.round(baseWithLvl * 1.25)
              : baseWithLvl;

          const waitSecs = 62 + metrics.hostLevel * 8 + chosenRecipe.ingredients.length * 6;

          nextCustomers.push({
            id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: chosenRegular
              ? chosenRegular.name
              : theme.customerNames[Math.floor(Math.random() * theme.customerNames.length)],
            regularId: chosenRegular?.id,
            tableUid: chosenTable.uid,
            gx: 0,
            gy: tier.rows - 1,
            targetGx: chosenTable.gx,
            targetGy: chosenTable.gy,
            phase: CustomerPhase.ENTERING,
            recipeId: chosenRecipe.id,
            patienceLeft: 100,
            maxWaitSeconds: waitSecs,
            eatProgress: 0,
            payAmount,
            spriteOutfit: chosenRegular
              ? chosenRegular.spriteOutfit
              : OUTFIT_PALETTE[Math.floor(Math.random() * OUTFIT_PALETTE.length)],
            spriteHair: chosenRegular
              ? chosenRegular.spriteHair
              : HAIR_PALETTE[Math.floor(Math.random() * HAIR_PALETTE.length)],
          });
        }
      }

      setCustomers(nextCustomers);
    }, 250);

    return () => window.clearInterval(timer);
  }, [screen, pushLog, resetKitchenRuntime, spawnEffect, updateActiveSave]);

  const handleProceedNextDay = () => {
    setDaySummary(null);
    resetKitchenRuntime(activeSave);
    updateActiveSave((prev) => ({
      ...prev,
      day: prev.day + 1,
      minuteOfDay: 540,
      todayEarned: 0,
      todayServed: 0,
      todayRegularVisits: 0,
    }));
    retroAudio.playUnlockFanfare();
  };

  // Build Mode Furniture Placement & Removal
  const handleTileClick = (gx: number, gy: number) => {
    if (!activeSave) return;
    const tier =
      EXPANSION_TIERS.find((t) => t.level === activeSave.expansionLevel) || EXPANSION_TIERS[0];

    if (gy === 0) {
      setBuildFeedback('最上排為固定食材補給箱區，請擺放在第 2 排以下的地板格喔！');
      return;
    }
    if (gx === 0 && gy === tier.rows - 1) {
      setBuildFeedback('門口迎賓踏墊需保持暢通，無法擺放設備！');
      return;
    }

    const existing = activeSave.placedFurniture.find((f) => f.gx === gx && f.gy === gy);

    if (isRemoveMode) {
      if (!existing) {
        setBuildFeedback('此格沒有可回收的設備或家具。');
        return;
      }
      const def = FURNITURE_CATALOG.find((c) => c.id === existing.itemId);
      if (def) {
        const sameKindCount = activeSave.placedFurniture.filter(
          (f) => FURNITURE_CATALOG.find((c) => c.id === f.itemId)?.stationKind === def.stationKind
        ).length;
        if (
          (def.stationKind === StationKind.CUTTING_BOARD ||
            def.stationKind === StationKind.STOVE ||
            def.stationKind === StationKind.PLATE_RACK ||
            def.stationKind === StationKind.SINK ||
            def.stationKind === StationKind.TRASH_BIN ||
            def.stationKind === StationKind.TABLE) &&
          sameKindCount <= 1
        ) {
          setBuildFeedback(`店內至少需保留 1 座「${def.name}」類型的核心工作站才能正常運作！`);
          return;
        }
      }

      const refund = def ? Math.round(def.cost * 0.8) : 30;
      updateActiveSave((prev) => ({
        ...prev,
        gold: prev.gold + refund,
        placedFurniture: prev.placedFurniture.filter((f) => f.uid !== existing.uid),
      }));
      setCustomers((prev) => prev.filter((c) => c.tableUid !== existing.uid));
      retroAudio.playPlaceFurniture();
      setBuildFeedback(`已回收「${def?.name || '家具'}」，退還 ${refund} G。`);
      return;
    }

    if (existing) {
      setBuildFeedback('此格已有設備，請點擊空白格或開啟「拆除回收」調整位置。');
      return;
    }

    const itemDef = FURNITURE_CATALOG.find((c) => c.id === selectedFurnitureId);
    if (!itemDef) return;
    if (activeSave.gold < itemDef.cost) {
      setBuildFeedback(`金幣不足！購買「${itemDef.name}」需要 ${itemDef.cost} G。`);
      return;
    }

    const newPlaced: PlacedFurniture = {
      uid: `furn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      itemId: itemDef.id,
      gx,
      gy,
    };

    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - itemDef.cost,
      placedFurniture: [...prev.placedFurniture, newPlaced],
    }));
    if (itemDef.stationKind === StationKind.PLATE_RACK) {
      setCleanPlates((c) => c + 3);
    }
    retroAudio.playPlaceFurniture();
    setBuildFeedback(`已擺放「${itemDef.name}」！隨時可回店面營業測試新動線。`);
  };

  const handleExpandShop = () => {
    if (!activeSave) return;
    const nextTier = EXPANSION_TIERS.find((t) => t.level === activeSave.expansionLevel + 1);
    if (!nextTier || activeSave.gold < nextTier.upgradeCost) return;

    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - nextTier.upgradeCost,
      expansionLevel: nextTier.level,
      reputation: prev.reputation + 20,
    }));
    retroAudio.playUnlockFanfare();
    setBuildFeedback(`恭喜擴建為「${nextTier.name}」（${nextTier.cols}×${nextTier.rows} 格）！`);
  };

  // Recipe Lab Handlers
  const handleBuyIngredient = (ingId: string, qty: number) => {
    if (!activeSave) return;
    const ing = activeTheme.ingredients.find((i) => i.id === ingId);
    if (!ing) return;
    const totalCost = ing.cost * qty;
    if (activeSave.gold < totalCost) return;

    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - totalCost,
      inventory: {
        ...prev.inventory,
        [ingId]: (prev.inventory[ingId] || 0) + qty,
      },
    }));
    retroAudio.playPlaceFurniture();
  };

  const handleCraftCombo = (selectedIngs: string[]): { ok: boolean; message: string } => {
    if (!activeSave) return { ok: false, message: '尚未載入存檔' };
    const comboKey = [...selectedIngs].sort().join('+');

    for (const id of selectedIngs) {
      if ((activeSave.inventory[id] || 0) <= 0) {
        return { ok: false, message: '部分研發食材庫存不足！' };
      }
    }

    if (activeSave.triedCombos.includes(comboKey)) {
      return {
        ok: false,
        message: '這個組合先前已經嘗試過囉（未消耗食材），試試其他搭配吧！',
      };
    }

    const matchedRecipe = activeTheme.recipes.find((r) => {
      if (activeSave.unlockedRecipes.includes(r.id)) return false;
      const rKey = [...r.ingredients].sort().join('+');
      return rKey === comboKey;
    });

    if (matchedRecipe) {
      updateActiveSave((prev) => {
        const nextInv = { ...prev.inventory };
        selectedIngs.forEach((id) => {
          nextInv[id] = Math.max(0, (nextInv[id] || 0) - 1);
        });
        return {
          ...prev,
          inventory: nextInv,
          reputation: prev.reputation + matchedRecipe.charmGain,
          unlockedRecipes: [...prev.unlockedRecipes, matchedRecipe.id],
          recipeLevels: { ...prev.recipeLevels, [matchedRecipe.id]: 1 },
          triedCombos: [...prev.triedCombos, comboKey],
        };
      });
      retroAudio.playUnlockFanfare();
      return {
        ok: true,
        message: `研發成功！解鎖${matchedRecipe.isSecret ? '傳說隱藏食譜' : '新菜單'}「${matchedRecipe.name}」！現在客人會開始點這道菜囉！`,
      };
    }

    updateActiveSave((prev) => {
      const nextInv = { ...prev.inventory };
      selectedIngs.forEach((id) => {
        nextInv[id] = Math.max(0, (nextInv[id] || 0) - 1);
      });
      return {
        ...prev,
        gold: prev.gold + 15,
        inventory: nextInv,
        triedCombos: [...prev.triedCombos, comboKey],
      };
    });
    retroAudio.playExperimentFail();
    return {
      ok: true,
      message: '未合成出正式菜單，但試作品賣出獲得 15 G 補貼！',
    };
  };

  const handleUnlockHint = (recipeId: string) => {
    if (!activeSave || activeSave.gold < 60) return;
    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - 60,
      revealedHints: [...prev.revealedHints, recipeId],
    }));
    retroAudio.playCoin();
  };

  const handleUpgradeRecipe = (recipeId: string) => {
    if (!activeSave) return;
    const recipe = activeTheme.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const curLvl = activeSave.recipeLevels[recipeId] || 1;
    if (curLvl >= 5) return;
    const cost = Math.round(recipe.basePrice * 2.2 * curLvl);
    if (activeSave.gold < cost) return;

    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      recipeLevels: {
        ...prev.recipeLevels,
        [recipeId]: curLvl + 1,
      },
    }));
    retroAudio.playUnlockFanfare();
  };

  const handleSelectFeatured = (recipeId: string) => {
    updateActiveSave((prev) => ({
      ...prev,
      featuredRecipeId: recipeId,
    }));
    retroAudio.playServe();
  };

  const handleHireOrUpgradeStaff = (staffId: string) => {
    if (!activeSave) return;
    const staff = activeTheme.staffPool.find((s) => s.id === staffId);
    if (!staff) return;
    const curLvl = activeSave.hiredStaffLevels[staffId] || 0;
    if (curLvl >= 5) return;

    const cost = curLvl === 0 ? staff.hireCost : Math.round(staff.upgradeBaseCost * curLvl);
    if (activeSave.gold < cost) return;

    updateActiveSave((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      hiredStaffLevels: {
        ...prev.hiredStaffLevels,
        [staffId]: curLvl + 1,
      },
    }));
    retroAudio.playUnlockFanfare();
    pushLog(
      curLvl === 0
        ? `新夥伴「${staff.name}」加入廚房團隊！`
        : `「${staff.name}」培訓升至 Lv.${curLvl + 1}！`
    );
  };

  const metrics = useMemo(() => {
    if (!activeSave) return null;
    return computeShopMetrics(activeSave, activeTheme);
  }, [activeSave, activeTheme]);

  const filteredFurniture = useMemo(() => {
    if (furnitureFilter === 'ALL') return FURNITURE_CATALOG;
    return FURNITURE_CATALOG.filter((f) => f.category === furnitureFilter);
  }, [furnitureFilter]);

  const nextExpansion = activeSave
    ? EXPANSION_TIERS.find((t) => t.level === activeSave.expansionLevel + 1)
    : undefined;

  const openNextQueuedStory = () => {
    if (pendingStories.length === 0) return;
    const [first, ...rest] = pendingStories;
    setPendingStories(rest);
    setActiveStoryModal(first);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 font-sans">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-stone-800 bg-stone-950">
        <button
          type="button"
          onClick={handleReturnToBranches}
          className="font-display text-xl text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          像素小店物語
        </button>

        {screen === GameScreen.PLAYING ? (
          <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-sm font-medium text-stone-400">
            {(
              [
                [WorkspaceTab.SHOP_FLOOR, '廚房營業'],
                [WorkspaceTab.DECORATE, '裝潢動線'],
                [WorkspaceTab.RECIPE_LAB, '食譜研發'],
                [WorkspaceTab.STAFF, '二廚助手'],
                [WorkspaceTab.REGULARS, '熟客圖鑑'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${activeTab === tabKey
                    ? 'text-amber-300 border-amber-400'
                    : 'text-stone-400 border-transparent hover:text-stone-100'
                  }`}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-400">
            <button
              type="button"
              onClick={() => setSelectedTheme(ShopThemeId.CAT_BAKERY)}
              className={`hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${selectedTheme === ShopThemeId.CAT_BAKERY
                  ? 'text-amber-300 underline underline-offset-8'
                  : ''
                }`}
            >
              貓咪烘焙坊
            </button>
            <button
              type="button"
              onClick={() => setSelectedTheme(ShopThemeId.MAGIC_ALCHEMY)}
              className={`hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${selectedTheme === ShopThemeId.MAGIC_ALCHEMY
                  ? 'text-amber-300 underline underline-offset-8'
                  : ''
                }`}
            >
              魔法藥水店
            </button>
            <button
              type="button"
              onClick={() => setSelectedTheme(ShopThemeId.MIDNIGHT_DINER)}
              className={`hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${selectedTheme === ShopThemeId.MIDNIGHT_DINER
                  ? 'text-amber-300 underline underline-offset-8'
                  : ''
                }`}
            >
              燈火深夜食堂
            </button>
            <button
              type="button"
              onClick={() => setShowGuideOnTitle((v) => !v)}
              className="hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              操作指南
            </button>
          </nav>
        )}

        <div className="shrink-0">
          {screen === GameScreen.PLAYING ? (
            <button
              type="button"
              onClick={handleReturnToBranches}
              className="px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              切換分店
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                handleStartShop(
                  selectedTheme,
                  saves[selectedTheme]?.shopName || activeTheme.defaultShopName
                )
              }
              className="px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {saves[selectedTheme] ? '進廚房開工' : '換裝開張'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {screen === GameScreen.TITLE || !activeSave || !metrics ? (
          <TitleScreen
            saves={saves}
            selectedTheme={selectedTheme}
            onSelectTheme={setSelectedTheme}
            onStartShop={handleStartShop}
            onResetSave={handleResetSave}
            showGuideSection={showGuideOnTitle}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
            {/* Workspace HUD Bar */}
            <section className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-display text-base text-stone-100">
                  {activeSave.shopName}
                </span>
                <span className="text-stone-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-300 font-semibold">
                  金幣 {activeSave.gold} G
                </span>
                <span className="text-stone-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-stone-300">
                  魅力 {metrics.charm}
                </span>
                <span className="text-stone-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-stone-300">
                  第 {activeSave.day} 天 {formatClock(activeSave.minuteOfDay)}
                </span>
                {combo >= 2 && (
                  <>
                    <span className="text-stone-600" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-emerald-400">
                      上菜連擊 x{combo} (+{combo * 5}%)
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isPaused
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100'
                    }`}
                >
                  {isPaused ? '繼續營業' : '暫停時間'}
                </button>

                <button
                  type="button"
                  onClick={() => setStaffAssistEnabled((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${staffAssistEnabled
                      ? 'bg-stone-800 border-emerald-500/50 text-emerald-300'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                >
                  {staffAssistEnabled ? '店員協助：開啟' : '純手動挑戰模式'}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoNextDay((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${autoNextDay
                      ? 'bg-stone-800 border-amber-500/60 text-amber-300'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                >
                  {autoNextDay ? '自動跨日：開' : '自動跨日：關'}
                </button>

                <button
                  type="button"
                  onClick={toggleSound}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {soundEnabled ? '音效：開啟' : '音效：靜音'}
                </button>
              </div>
            </section>

            {/* Queued Story Event Banner */}
            {pendingStories.length > 0 && (
              <div className="bg-stone-900 border border-amber-500/70 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-amber-200">
                  熟客「{pendingStories[0].regular.name}」好感度提升，解鎖了全新故事《{pendingStories[0].chapter.title}》！
                </p>
                <button
                  type="button"
                  onClick={openNextQueuedStory}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  觀看故事並領取謝禮
                </button>
              </div>
            )}

            {/* TAB 1: OVERCOOKED LIVE PIXEL KITCHEN */}
            {activeTab === WorkspaceTab.SHOP_FLOOR && (
              <div className="space-y-4">
                {/* Top Order Ticket Rail */}
                <OrderTicketBar
                  customers={customers}
                  theme={activeTheme}
                  onFocusCustomerTable={(gx, gy) => handlePlayTileClick(gx, gy, 'INTERACT')}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-9">
                    <ShopFloorCanvas
                      theme={activeTheme}
                      expansionLevel={activeSave.expansionLevel}
                      minuteOfDay={activeSave.minuteOfDay}
                      placedFurniture={activeSave.placedFurniture}
                      player={player}
                      boards={boards}
                      stoves={stoves}
                      counters={counters}
                      cleanPlates={cleanPlates}
                      sink={sink}
                      dirtyTables={dirtyTables}
                      customers={customers}
                      effects={effects}
                      flyingItems={flyingItems}
                      floorItems={floorItems}
                      hiredStaffLevels={activeSave.hiredStaffLevels}
                      staffAssistEnabled={staffAssistEnabled}
                      isBuildMode={false}
                      isRemoveMode={false}
                      selectedFurnitureId={null}
                      onTileClick={() => { }}
                      onPlayTileClick={handlePlayTileClick}
                      onManualMoveStep={handleManualMoveStep}
                      onManualInteract={handleManualInteract}
                      onManualWork={handleManualWork}
                      onManualThrow={handleManualThrow}
                    />
                  </div>

                  {/* Right 3 Columns: Chef Hands Status + Active Recipe Cheat-Sheet + Kitchen Log */}
                  <aside className="lg:col-span-3 bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4">
                    {/* Chef Hands Status */}
                    <div className="space-y-2">
                      <h2 className="font-display text-base text-stone-100">主廚手中狀態</h2>
                      <div className="p-3 bg-stone-950 border border-stone-800 rounded-lg text-xs text-amber-200 leading-relaxed">
                        <div>{getHeldItemLabel(player.held, activeTheme)}</div>
                        {player.held && (
                          <div className="mt-2 text-[11px] text-orange-300 font-medium">
                            💡 提示：按 <b>Q</b> 鍵或點擊「投擲物品」可向前方空投！
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-stone-400 font-mono tabular-nums pt-1">
                        <span>乾淨餐盤：{cleanPlates} 個</span>
                        <span>待洗髒盤：{sink.dirtyCount} 個</span>
                      </div>
                    </div>

                    {/* Unlocked Recipes Quick Formula Reference */}
                    <div className="space-y-2.5 pt-3 border-t border-stone-800">
                      <h3 className="font-display text-sm text-stone-200">已解鎖料理食譜速查</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {activeTheme.recipes
                          .filter((r) => activeSave.unlockedRecipes.includes(r.id))
                          .map((r) => {
                            const ingNames = r.ingredients
                              .map(
                                (id) =>
                                  activeTheme.ingredients.find((i) => i.id === id)?.shortName || id
                              )
                              .join(' + ');
                            return (
                              <div
                                key={r.id}
                                className="p-2.5 bg-stone-950 border border-stone-800 rounded-lg flex items-center gap-2.5"
                              >
                                <PixelItemIcon spriteKey={r.spriteKey} size={24} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-stone-100 truncate">
                                    {r.name}
                                  </p>
                                  <p className="text-xs text-stone-400 truncate">{ingNames}</p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Kitchen Log */}
                    <div className="space-y-1.5 pt-3 border-t border-stone-800">
                      <h3 className="text-xs font-medium text-stone-400">廚房即時動態</h3>
                      <div className="space-y-1 text-xs">
                        {eventLog.map((line, idx) => (
                          <p
                            key={idx}
                            className="leading-relaxed text-stone-400 first:text-stone-200"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {/* TAB 2: DECORATE & KITCHEN LAYOUT BUILDER */}
            {activeTab === WorkspaceTab.DECORATE && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <ShopFloorCanvas
                    theme={activeTheme}
                    expansionLevel={activeSave.expansionLevel}
                    minuteOfDay={activeSave.minuteOfDay}
                    placedFurniture={activeSave.placedFurniture}
                    player={player}
                    boards={boards}
                    stoves={stoves}
                    counters={counters}
                    cleanPlates={cleanPlates}
                    sink={sink}
                    dirtyTables={dirtyTables}
                    customers={customers}
                    effects={effects}
                    floorItems={floorItems}
                    hiredStaffLevels={activeSave.hiredStaffLevels}
                    staffAssistEnabled={staffAssistEnabled}
                    isBuildMode={true}
                    isRemoveMode={isRemoveMode}
                    selectedFurnitureId={selectedFurnitureId}
                    onTileClick={handleTileClick}
                    onPlayTileClick={() => { }}
                    onManualMoveStep={() => { }}
                    onManualInteract={() => { }}
                    onManualWork={() => { }}
                  />
                  <p className="text-xs text-amber-200 px-1">{buildFeedback}</p>
                </div>

                <aside className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-xl text-stone-100">廚房動線與空間擴建</h2>
                    <button
                      type="button"
                      onClick={() => setIsRemoveMode((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isRemoveMode
                          ? 'bg-rose-600 text-white'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                        }`}
                    >
                      {isRemoveMode ? '拆除回收模式中 (退80%)' : '切換拆除回收'}
                    </button>
                  </div>

                  {/* Expansion Upgrade */}
                  <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-100">
                        店面規模 Lv.{activeSave.expansionLevel}/3
                      </span>
                      <span className="text-xs text-stone-400 font-mono tabular-nums">
                        爐台 {metrics.stoves.length} · 餐桌 {metrics.tables.length} · 防焦 +{metrics.antiBurnBonusPct}%
                      </span>
                    </div>

                    {nextExpansion ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-stone-400">{nextExpansion.description}</p>
                        <button
                          type="button"
                          onClick={handleExpandShop}
                          disabled={activeSave.gold < nextExpansion.upgradeCost}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0 font-mono tabular-nums cursor-pointer"
                        >
                          擴建空間 ({nextExpansion.upgradeCost} G)
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400">
                        已擴建至最大 14×9 鎮上傳奇美食旗艦店！
                      </p>
                    )}
                  </div>

                  {/* Category Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-stone-950 border border-stone-800 rounded-lg">
                    {(
                      [
                        ['ALL', '全部項目'],
                        [FurnitureCategory.KITCHEN, '廚房工作站'],
                        [FurnitureCategory.TABLE, '客席餐桌'],
                        [FurnitureCategory.DECOR, '魅力裝飾'],
                      ] as const
                    ).map(([cat, label]) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFurnitureFilter(cat);
                          setIsRemoveMode(false);
                        }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${furnitureFilter === cat
                            ? 'bg-stone-800 text-amber-300'
                            : 'text-stone-400 hover:text-stone-200'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Catalog List */}
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {filteredFurniture.map((item) => {
                      const isPicked = !isRemoveMode && selectedFurnitureId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setIsRemoveMode(false);
                            setSelectedFurnitureId(item.id);
                            setBuildFeedback(
                              `已選取「${item.name}」（${item.cost} G），請點擊左側空白格擺放（注意保留行走通道！）。`
                            );
                          }}
                          className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer ${isPicked
                              ? 'bg-stone-950 border-amber-500'
                              : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                            }`}
                        >
                          <PixelItemIcon spriteKey={item.spriteKey} size={36} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-stone-100 truncate">
                                {item.name}
                              </span>
                              <span className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                                {item.cost} G
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                            <p className="text-xs text-stone-300 font-mono tabular-nums mt-1">
                              魅力 +{item.charmBonus}
                              {item.tipBonusPct > 0 ? ` · 小費 +${item.tipBonusPct}%` : ''}
                              {item.antiBurnBonusPct > 0
                                ? ` · 防燒焦緩衝 +${item.antiBurnBonusPct}%`
                                : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>
            )}

            {/* TAB 3: RECIPE LAB */}
            {activeTab === WorkspaceTab.RECIPE_LAB && (
              <RecipeLabPanel
                theme={activeTheme}
                save={activeSave}
                onBuyIngredient={handleBuyIngredient}
                onCraftCombo={handleCraftCombo}
                onUnlockHint={handleUnlockHint}
                onUpgradeRecipe={handleUpgradeRecipe}
                onSelectFeatured={handleSelectFeatured}
              />
            )}

            {/* TAB 4: KITCHEN STAFF HELPERS */}
            {activeTab === WorkspaceTab.STAFF && (
              <div className="space-y-6">
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl text-stone-100">像素二廚與外場助手招募</h2>
                    <p className="text-xs text-stone-400 mt-1">
                      你依然親自掌廚拿料與下鍋盛盤！招募助手可幫你自動切好備料台上的食材、延長防燒焦時間，並自動收回髒盤洗碗；也可隨時在上方切換「純手動挑戰模式」。
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-stone-300 shrink-0">
                    在職夥伴：
                    {Object.values(activeSave.hiredStaffLevels).filter((lvl) => lvl > 0).length} / 4
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTheme.staffPool.map((staff) => {
                    const lvl = activeSave.hiredStaffLevels[staff.id] || 0;
                    const cost = lvl === 0 ? staff.hireCost : Math.round(staff.upgradeBaseCost * lvl);

                    return (
                      <div
                        key={staff.id}
                        className="bg-stone-900 border border-stone-800 rounded-xl p-6 flex flex-col justify-between space-y-5"
                      >
                        <div className="flex items-start gap-4">
                          <PixelCharacterAvatar
                            hairColor={staff.hatColor}
                            outfitColor={staff.spriteColor}
                            size={56}
                          />
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-display text-xl text-stone-100">{staff.name}</h3>
                              <span className="text-xs font-mono tabular-nums text-amber-300">
                                {lvl === 0 ? '尚未招募' : `Lv.${lvl}/5`}
                              </span>
                            </div>
                            <p className="text-xs text-stone-400">{staff.roleTitle}</p>
                            <p className="text-xs text-stone-300 leading-relaxed pt-1">
                              {staff.description}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-800 flex items-center justify-between gap-4">
                          <span className="text-xs text-stone-400 font-mono tabular-nums">
                            {staff.roleType === 'CHEF' &&
                              (lvl > 0
                                ? `自動切菜 Lv.${lvl} · 防燒焦緩衝 +${lvl * 25}%`
                                : '招募後開啟自動切備料與控火')}
                            {staff.roleType === 'SERVER' &&
                              (lvl > 0
                                ? `自動收髒盤與洗碗效率：Lv.${lvl}`
                                : '招募後自動收桌洗碗')}
                            {staff.roleType === 'HOST' &&
                              `顧客耐心 +${lvl * 8} 秒 · 小費 +${lvl * 6}%`}
                            {staff.roleType === 'BUYER' &&
                              (lvl > 0
                                ? `每日打烊免費帶回 ${lvl + 1} 份研發食材`
                                : '招募後每日打烊自動補貨')}
                          </span>

                          {lvl < 5 ? (
                            <button
                              type="button"
                              onClick={() => handleHireOrUpgradeStaff(staff.id)}
                              disabled={activeSave.gold < cost}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0 font-mono tabular-nums transition-colors cursor-pointer"
                            >
                              {lvl === 0 ? `招募夥伴 (${cost} G)` : `培訓升級 (${cost} G)`}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
                              已達大師等級
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: REGULARS ENCYCLOPEDIA */}
            {activeTab === WorkspaceTab.REGULARS && (
              <RegularsPanel
                theme={activeTheme}
                save={activeSave}
                onReplayChapter={(reg: RegularDef, ch: StoryChapter) =>
                  setActiveStoryModal({ regular: reg, chapter: ch, isReplay: true })
                }
              />
            )}
          </div>
        )}
      </main>

      <footer className="px-6 py-4 border-t border-stone-900 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-4">
        <span>像素小店物語 · 實境廚房操作模式（WASD + Space / F 或滑鼠點擊）</span>
        <span>貓咪烘焙坊 · 星塵藥水店 · 燈火深夜食堂</span>
      </footer>

      <StoryEventModal
        modalData={activeStoryModal}
        theme={activeTheme}
        onClose={() => setActiveStoryModal(null)}
      />

      {daySummary && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-summary-title"
        >
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-xl p-6 space-y-5 pixel-shadow">
            <div>
              <p className="text-xs text-amber-400">今日順利打烊 · 21:00</p>
              <h3 id="day-summary-title" className="font-display text-2xl text-stone-100 mt-1">
                第 {daySummary.dayFinished} 天營業結算
              </h3>
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">今日總營收</span>
                <span className="font-mono tabular-nums text-amber-300 font-semibold">
                  +{daySummary.earned} G
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400">親手出餐招待</span>
                <span className="font-mono tabular-nums text-stone-100">
                  {daySummary.served} 盤
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400">熟客光臨次數</span>
                <span className="font-mono tabular-nums text-rose-300">
                  {daySummary.regularVisits} 次
                </span>
              </div>
              {daySummary.buyerLootText && (
                <p className="text-xs text-emerald-300 pt-2 border-t border-stone-800">
                  {daySummary.buyerLootText}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleProceedNextDay}
                className="w-full py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                迎接第 {daySummary.dayFinished + 1} 天晨光
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
