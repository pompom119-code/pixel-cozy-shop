import React, { useState } from 'react';
import { HERO_STREET_IMAGE, SHOP_THEMES } from '../data/themes';
import { ShopSaveState, ShopThemeId } from '../types/game';
import { PixelItemIcon } from './PixelSprites';

interface TitleScreenProps {
  saves: Partial<Record<ShopThemeId, ShopSaveState>>;
  selectedTheme: ShopThemeId;
  onSelectTheme: (themeId: ShopThemeId) => void;
  onStartShop: (themeId: ShopThemeId, shopName: string) => void;
  onResetSave: (themeId: ShopThemeId) => void;
  showGuideSection: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saves,
  selectedTheme,
  onSelectTheme,
  onStartShop,
  onResetSave,
  showGuideSection,
}) => {
  const activeConfig = SHOP_THEMES[selectedTheme];
  const existingSave = saves[selectedTheme];

  const [customNames, setCustomNames] = useState<Record<ShopThemeId, string>>({
    [ShopThemeId.CAT_BAKERY]:
      saves[ShopThemeId.CAT_BAKERY]?.shopName ||
      SHOP_THEMES[ShopThemeId.CAT_BAKERY].defaultShopName,
    [ShopThemeId.MAGIC_ALCHEMY]:
      saves[ShopThemeId.MAGIC_ALCHEMY]?.shopName ||
      SHOP_THEMES[ShopThemeId.MAGIC_ALCHEMY].defaultShopName,
    [ShopThemeId.MIDNIGHT_DINER]:
      saves[ShopThemeId.MIDNIGHT_DINER]?.shopName ||
      SHOP_THEMES[ShopThemeId.MIDNIGHT_DINER].defaultShopName,
  });

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const markBroken = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  const currentName = existingSave ? existingSave.shopName : customNames[selectedTheme];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      {/* Hero 2-Column Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-stone-900 border border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-amber-400 tracking-wide">
              像素版《煮過頭》實境廚房操作 · 三大主題分店自由養成
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-stone-100 leading-tight text-balance">
              親手拿食材、切備烹煮，打造你的像素小店物語
            </h1>
            <p className="text-base text-stone-300 leading-relaxed max-w-xl">
              親自操控像素主廚穿梭廚房：從食材箱拿取生鮮原料、在備料台切碎揉製、投入爐鍋控火烹煮（小心別煮過頭燒焦！）、拿乾淨餐盤盛裝端給客人，還能自由裝潢動線、研發隱藏食譜與解鎖熟客故事。
            </p>
          </div>

          <div className="pt-4 border-t border-stone-800 space-y-4">
            <div className="space-y-2">
              <label htmlFor="shop-name-input" className="block text-sm font-medium text-stone-300">
                {existingSave ? '目前營業店名（已自動存檔）' : '為你的新小店取個名字'}
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="shop-name-input"
                  type="text"
                  maxLength={14}
                  disabled={Boolean(existingSave)}
                  value={currentName}
                  onChange={(e) =>
                    setCustomNames((prev) => ({
                      ...prev,
                      [selectedTheme]: e.target.value,
                    }))
                  }
                  placeholder={activeConfig.defaultShopName}
                  className="flex-1 px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75"
                />
                <button
                  type="button"
                  onClick={() => onStartShop(selectedTheme, currentName)}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 pixel-shadow-sm cursor-pointer"
                >
                  {existingSave ? `進廚房開工（第 ${existingSave.day} 天）` : '換上廚師袍開張'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
              <span>
                當前選擇：{activeConfig.title} · 初始資金{' '}
                <span className="font-mono tabular-nums text-stone-200">420 G</span>
              </span>
              {existingSave && (
                <button
                  type="button"
                  onClick={() => onResetSave(selectedTheme)}
                  className="text-rose-400 hover:text-rose-300 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  重設此分店進度
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative rounded-lg overflow-hidden border border-stone-800 bg-stone-950 min-h-64">
          {!brokenImages.hero ? (
            <img
              src={HERO_STREET_IMAGE}
              alt="黃昏時分的復古像素溫馨商店街景"
              referrerPolicy="no-referrer"
              onError={() => markBroken('hero')}
              className="w-full h-full lg:h-full object-cover pixel-art"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-stone-950 text-center space-y-3">
              <PixelItemIcon spriteKey="STOVE_MASTER" size={64} />
              <p className="font-display text-lg text-amber-300">像素小店商店街</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5">
            <p className="font-display text-base text-amber-200">
              支援鍵盤 WASD + Space / F 操作，或滑鼠點擊工作站自動跑位烹飪！
            </p>
          </div>
        </div>
      </section>

      {/* Theme Selection Cards */}
      <section id="themes" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-stone-100">01. 選擇你的像素小店主題</h2>
            <p className="text-sm text-stone-400 mt-1">
              每個世界皆擁有專屬 8 座食材箱、傳說隱藏食譜、廚房二廚助手與 6 位熟客故事。
            </p>
          </div>
          <p className="text-xs text-stone-400 font-mono tabular-nums">
            已開張分店：{Object.keys(saves).length} / 3
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.values(SHOP_THEMES) as typeof activeConfig[]).map((theme) => {
            const isSelected = selectedTheme === theme.id;
            const save = saves[theme.id];
            const starterDish = theme.recipes[0];

            return (
              <div
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTheme(theme.id);
                  }
                }}
                className={`group rounded-xl border transition-transform duration-150 overflow-hidden flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isSelected
                    ? 'bg-stone-900 border-amber-500 -translate-y-0.5'
                    : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div>
                  <div className="aspect-4/3 w-full bg-stone-950 overflow-hidden relative border-b border-stone-800">
                    {!brokenImages[theme.id] ? (
                      <img
                        src={theme.previewImage}
                        alt={`${theme.title}像素店內預覽`}
                        referrerPolicy="no-referrer"
                        onError={() => markBroken(theme.id)}
                        className="w-full h-full object-cover pixel-art group-hover:scale-103 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-950">
                        <PixelItemIcon spriteKey={starterDish.spriteKey} size={56} />
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl text-stone-100">{theme.title}</h3>
                      <PixelItemIcon spriteKey={starterDish.spriteKey} size={28} />
                    </div>
                    <p className="text-xs text-stone-400">{theme.subtitle}</p>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      初始招牌：
                      {theme.recipes
                        .filter((r) => r.isStarter)
                        .map((r) => r.name)
                        .join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-stone-800/80 flex items-center justify-between gap-3">
                  {save ? (
                    <span className="text-xs text-amber-300 font-mono tabular-nums">
                      第 {save.day} 天 · {save.gold} G · 食譜 {save.unlockedRecipes.length}/8
                    </span>
                  ) : (
                    <span className="text-xs text-stone-500">尚未開張 · 點擊選擇</span>
                  )}

                  <span
                    className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                      isSelected ? 'text-amber-400' : 'text-stone-400 group-hover:text-stone-200'
                    }`}
                  >
                    {isSelected ? '已選定' : '選擇此店'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Overcooked Kitchen Workflow Guide */}
      {showGuideSection && (
        <section id="guide" className="bg-stone-900/70 border border-stone-800 rounded-xl p-6 lg:p-8 space-y-6">
          <div>
            <h2 className="font-display text-2xl text-stone-100">02. 像素廚房五步實境烹飪指南</h2>
            <p className="text-sm text-stone-400 mt-1">
              就像《煮過頭》一樣講究動線與火候掌控，還能自由改裝廚房擺設提升效率！
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <PixelItemIcon spriteKey="STATION_BOARD" size={28} />
                <h3 className="font-semibold text-stone-100 text-sm">1. 拿取食材與切菜備料</h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                從上方食材箱拿取生鮮原料（Space 或點擊），放到「橡木切菜備料台」按 F 切碎或揉製完成備料。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <PixelItemIcon spriteKey="STOVE_MASTER" size={28} />
                <h3 className="font-semibold text-stone-100 text-sm">2. 入鍋組合與防燒焦</h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                依訂單配方將 1～3 種已備料食材投入同一口爐鍋；煮熟後務必趁防焦條耗盡前拿「乾淨餐盤」盛出，否則會燒焦！
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <PixelItemIcon spriteKey="STATION_SINK" size={28} />
                <h3 className="font-semibold text-stone-100 text-sm">3. 端菜上桌與收盤洗碗</h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                將盛盤料理端給客人即可賺取早鳥連擊小費！客人用餐後記得收走髒盤子放到洗碗槽按 F 洗淨循環使用。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <PixelItemIcon spriteKey="DISH_SECRET_1" size={28} />
                <h3 className="font-semibold text-stone-100 text-sm">4. 改裝動線與研發秘方</h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                賺取金幣後可自由重新擺放切菜台、流理台與防焦銅爐優化跑位，或在鍋裡直接嘗試新食材組合解鎖隱藏食譜！
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
