export enum ShopThemeId {
  CAT_BAKERY = 'CAT_BAKERY',
  MAGIC_ALCHEMY = 'MAGIC_ALCHEMY',
  MIDNIGHT_DINER = 'MIDNIGHT_DINER',
}

export enum GameScreen {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
}

export enum WorkspaceTab {
  SHOP_FLOOR = 'SHOP_FLOOR',
  DECORATE = 'DECORATE',
  RECIPE_LAB = 'RECIPE_LAB',
  STAFF = 'STAFF',
  REGULARS = 'REGULARS',
}

export enum FurnitureCategory {
  KITCHEN = 'KITCHEN',
  TABLE = 'TABLE',
  DECOR = 'DECOR',
}

export enum StationKind {
  CUTTING_BOARD = 'CUTTING_BOARD',
  STOVE = 'STOVE',
  COUNTER = 'COUNTER',
  PLATE_RACK = 'PLATE_RACK',
  SINK = 'SINK',
  TRASH_BIN = 'TRASH_BIN',
  TABLE = 'TABLE',
  DECOR = 'DECOR',
}

export enum CustomerPhase {
  ENTERING = 'ENTERING',
  WAITING_FOOD = 'WAITING_FOOD',
  EATING = 'EATING',
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type HeldItem =
  | { kind: 'RAW_INGREDIENT'; ingId: string }
  | { kind: 'PREPPED_INGREDIENT'; ingId: string }
  | { kind: 'CLEAN_PLATE' }
  | {
      kind: 'PLATED_DISH';
      recipeId: string | null;
      dishName: string;
      spriteKey: string;
    }
  | { kind: 'BURNT_FOOD' }
  | { kind: 'DIRTY_PLATE' };

export interface PlayerChefState {
  x: number; // grid float coordinate (0 .. cols-1)
  y: number; // grid float coordinate (1 .. rows-1; row 0 is ingredient crate wall)
  facing: Direction;
  held: HeldItem | null;
  autoPath: Array<{ gx: number; gy: number }>;
  pendingStationTarget: { gx: number; gy: number; mode: 'INTERACT' | 'WORK' } | null;
}

export interface BoardState {
  ingId: string;
  isPrepped: boolean;
  chopProgress: number; // 0 to 100
}

export interface StoveState {
  ingredients: string[]; // 1 to 3 prepped ingIds
  status: 'EMPTY' | 'COOKING' | 'COOKED' | 'BURNT';
  cookProgress: number; // 0 to 100
  burnProgress: number; // 0 to 100 once COOKED
}

export interface SinkState {
  dirtyCount: number;
  washProgress: number; // 0 to 100
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  stationKind: StationKind;
  cost: number;
  charmBonus: number;
  tipBonusPct: number;
  antiBurnBonusPct: number;
  spriteKey: string;
  description: string;
  isCoreProtected?: boolean;
}

export interface PlacedFurniture {
  uid: string;
  itemId: string;
  gx: number;
  gy: number;
}

export interface IngredientDef {
  id: string;
  name: string;
  shortName: string;
  cost: number;
  spriteKey: string;
  flavorNote: string;
  isRare?: boolean;
}

export interface RecipeDef {
  id: string;
  name: string;
  ingredients: string[];
  basePrice: number;
  cookSeconds: number;
  charmGain: number;
  spriteKey: string;
  isStarter?: boolean;
  isSecret?: boolean;
  hint: string;
  description: string;
}

export interface StaffDef {
  id: string;
  name: string;
  roleTitle: string;
  roleType: 'CHEF' | 'SERVER' | 'HOST' | 'BUYER';
  hireCost: number;
  upgradeBaseCost: number;
  spriteColor: string;
  hatColor: string;
  description: string;
}

export interface StoryChapter {
  levelRequired: number;
  title: string;
  dialogue: string[];
  rewardGold: number;
  rewardIngredientId?: string;
  rewardIngredientQty?: number;
}

export interface RegularDef {
  id: string;
  name: string;
  title: string;
  bio: string;
  favoriteRecipeId: string;
  spriteHair: string;
  spriteOutfit: string;
  accessory: 'GLASSES' | 'WITCH_HAT' | 'CAP' | 'FLOWER' | 'HEADPHONES' | 'SCARF';
  chapters: StoryChapter[];
  keepsakeName: string;
}

export interface ShopThemeConfig {
  id: ShopThemeId;
  title: string;
  subtitle: string;
  defaultShopName: string;
  previewImage: string;
  floorPrimary: string;
  floorSecondary: string;
  kitchenFloorPrimary: string;
  kitchenFloorSecondary: string;
  wallColor: string;
  trimColor: string;
  accentHex: string;
  ingredients: IngredientDef[];
  recipes: RecipeDef[];
  staffPool: StaffDef[];
  regulars: RegularDef[];
  customerNames: string[];
}

export interface LiveCustomer {
  id: string;
  name: string;
  regularId?: string;
  tableUid: string;
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  phase: CustomerPhase;
  recipeId: string;
  patienceLeft: number; // 0 to 100 (decreases slowly while WAITING_FOOD)
  maxWaitSeconds: number;
  eatProgress: number; // 0 to 100
  payAmount: number;
  spriteOutfit: string;
  spriteHair: string;
}

export interface FloatingEffect {
  id: string;
  gx: number;
  gy: number;
  text: string;
  tone: 'GOLD' | 'HEART' | 'COMBO' | 'COOK' | 'WARN';
}

export interface StoryModalData {
  regular: RegularDef;
  chapter: StoryChapter;
  isReplay?: boolean;
}

export interface ShopSaveState {
  themeId: ShopThemeId;
  shopName: string;
  gold: number;
  reputation: number;
  day: number;
  minuteOfDay: number; // 540 (09:00) to 1260 (21:00)
  expansionLevel: number; // 1 (10x7), 2 (12x8), 3 (14x9)
  placedFurniture: PlacedFurniture[];
  inventory: Record<string, number>;
  unlockedRecipes: string[];
  recipeLevels: Record<string, number>;
  featuredRecipeId: string;
  triedCombos: string[];
  revealedHints: string[];
  hiredStaffLevels: Record<string, number>;
  regularPoints: Record<string, number>;
  unlockedChapters: Record<string, number[]>;
  totalServed: number;
  todayEarned: number;
  todayServed: number;
  todayRegularVisits: number;
}
