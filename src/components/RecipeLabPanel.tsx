import React, { useState } from 'react';
import { ShopSaveState, ShopThemeConfig } from '../types/game';
import { PixelItemIcon } from './PixelSprites';

interface RecipeLabPanelProps {
  theme: ShopThemeConfig;
  save: ShopSaveState;
  onBuyIngredient: (ingId: string, qty: number) => void;
  onCraftCombo: (selectedIngs: string[]) => { ok: boolean; message: string };
  onUnlockHint: (recipeId: string) => void;
  onUpgradeRecipe: (recipeId: string) => void;
  onSelectFeatured: (recipeId: string) => void;
}

export const RecipeLabPanel: React.FC<RecipeLabPanelProps> = ({
  theme,
  save,
  onBuyIngredient,
  onCraftCombo,
  onUnlockHint,
  onUpgradeRecipe,
  onSelectFeatured,
}) => {
  const [potSlots, setPotSlots] = useState<string[]>([]);
  const [labFeedback, setLabFeedback] = useState<string>(
    '挑選 2 至 3 種不同食材放入合成鍋，即可嘗試研發新菜單與隱藏秘方！'
  );

  const toggleSlot = (ingId: string) => {
    if (potSlots.includes(ingId)) {
      setPotSlots((prev) => prev.filter((id) => id !== ingId));
      return;
    }
    if ((save.inventory[ingId] || 0) <= 0) {
      setLabFeedback('此食材庫存不足，請先從下方採購補貨。');
      return;
    }
    if (potSlots.length >= 3) {
      setLabFeedback('研發合成鍋最多同時投入 3 種食材。');
      return;
    }
    setPotSlots((prev) => [...prev, ingId]);
  };

  const handleSynthesize = () => {
    if (potSlots.length < 2) {
      setLabFeedback('請至少選擇 2 種不同食材再開始研發。');
      return;
    }
    const res = onCraftCombo(potSlots);
    setLabFeedback(res.message);
    if (res.ok) {
      setPotSlots([]);
    }
  };

  const lockedRecipes = theme.recipes.filter((r) => !save.unlockedRecipes.includes(r.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left 7 Columns: Synthesis Pot + Ingredient Market */}
      <div className="lg:col-span-7 space-y-6">
        <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl text-stone-100">食材組合研發鍋</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                已解鎖食譜 <span className="font-mono tabular-nums text-amber-300">{save.unlockedRecipes.length} / {theme.recipes.length}</span> · 失敗組合也會紀錄避免重複消耗
              </p>
            </div>
            {potSlots.length > 0 && (
              <button
                type="button"
                onClick={() => setPotSlots([])}
                className="text-xs text-stone-400 hover:text-stone-200 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                清空鍋內食材
              </button>
            )}
          </div>

          {/* 3 Crafting Slots */}
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((slotIdx) => {
              const ingId = potSlots[slotIdx];
              const ing = theme.ingredients.find((i) => i.id === ingId);
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => ingId && toggleSlot(ingId)}
                  className={`h-24 rounded-lg border flex flex-col items-center justify-center p-3 transition-colors cursor-pointer ${
                    ing
                      ? 'bg-stone-950 border-amber-500/80 text-stone-100'
                      : 'bg-stone-950/50 border-dashed border-stone-700 text-stone-500'
                  }`}
                >
                  {ing ? (
                    <>
                      <PixelItemIcon spriteKey={ing.spriteKey} size={32} />
                      <span className="text-xs font-medium mt-1.5 truncate max-w-full">{ing.name}</span>
                    </>
                  ) : (
                    <span className="text-xs">食材欄位 {slotIdx + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-stone-800">
            <p className="text-xs text-amber-200/90 leading-relaxed">{labFeedback}</p>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={potSlots.length < 2}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              開始研發新食譜
            </button>
          </div>
        </section>

        {/* Ingredient Pantry & Market */}
        <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-stone-100">像素食材儲藏室與採購</h3>
            <span className="text-xs text-stone-400">點擊食材圖示可投入研發鍋</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {theme.ingredients.map((ing) => {
              const count = save.inventory[ing.id] || 0;
              const inPot = potSlots.includes(ing.id);

              return (
                <div
                  key={ing.id}
                  className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                    inPot
                      ? 'bg-stone-950 border-amber-500'
                      : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSlot(ing.id)}
                    className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <PixelItemIcon spriteKey={ing.spriteKey} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-100 truncate">
                        {ing.name} {ing.isRare ? '· 珍稀' : ''}
                      </p>
                      <p className="text-xs text-stone-400 font-mono tabular-nums">
                        庫存 {count} · 單價 {ing.cost} G
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onBuyIngredient(ing.id, 1)}
                      disabled={save.gold < ing.cost}
                      className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-100 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuyIngredient(ing.id, 5)}
                      disabled={save.gold < ing.cost * 5}
                      className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-amber-300 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recipe Clues Notebook */}
        {lockedRecipes.length > 0 && (
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg text-stone-100">未發現食譜筆記線索</h3>
            <div className="divide-y divide-stone-800">
              {lockedRecipes.map((recipe) => {
                const isRevealed = save.revealedHints.includes(recipe.id);
                const ingredientNames = recipe.ingredients
                  .map((id) => theme.ingredients.find((i) => i.id === id)?.name || id)
                  .join(' + ');

                return (
                  <div key={recipe.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-stone-200">
                        {recipe.isSecret ? '傳說隱藏食譜（？？？ ）' : '待研發新菜單（？？？ ）'} · 需 {recipe.ingredients.length} 種食材
                      </p>
                      <p className="text-xs text-stone-400">
                        {isRevealed ? `完整配方：${ingredientNames}` : recipe.hint}
                      </p>
                    </div>
                    {!isRevealed && (
                      <button
                        type="button"
                        onClick={() => onUnlockHint(recipe.id)}
                        disabled={save.gold < 60}
                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-xs text-amber-300 rounded-md whitespace-nowrap shrink-0 font-mono tabular-nums cursor-pointer"
                      >
                        解鎖配方 (60 G)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Right 5 Columns: Unlocked Menu & Upgrades */}
      <section className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-xl text-stone-100">店鋪供應菜單與精進</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            營業中不消耗儲藏室食材；升級料理可永久提高售價，設為「主推招牌」額外增加 25% 售價！
          </p>
        </div>

        <div className="space-y-3">
          {theme.recipes
            .filter((r) => save.unlockedRecipes.includes(r.id))
            .map((recipe) => {
              const lvl = save.recipeLevels[recipe.id] || 1;
              const isFeatured = save.featuredRecipeId === recipe.id;
              const baseWithLvl = Math.round(recipe.basePrice * (1 + (lvl - 1) * 0.22));
              const displayPrice = isFeatured ? Math.round(baseWithLvl * 1.25) : baseWithLvl;
              const upgradeCost = Math.round(recipe.basePrice * 2.2 * lvl);

              return (
                <div
                  key={recipe.id}
                  className={`p-4 rounded-lg border space-y-3 ${
                    isFeatured
                      ? 'bg-stone-950 border-amber-500/80'
                      : 'bg-stone-950/60 border-stone-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <PixelItemIcon spriteKey={recipe.spriteKey} size={36} />
                      <div>
                        <h3 className="text-sm font-semibold text-stone-100">
                          {recipe.name} {recipe.isSecret ? '· 隱藏秘方' : ''}
                        </h3>
                        <p className="text-xs text-stone-400 font-mono tabular-nums mt-0.5">
                          Lv.{lvl}/5 · 售價 {displayPrice} G · 備餐 {recipe.cookSeconds} 秒
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-400 leading-relaxed">{recipe.description}</p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800/80">
                    <button
                      type="button"
                      onClick={() => onSelectFeatured(recipe.id)}
                      disabled={isFeatured}
                      className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isFeatured
                          ? 'bg-amber-500/20 text-amber-300 cursor-default'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                      }`}
                    >
                      {isFeatured ? '目前主推招牌 (+25%)' : '設為主推招牌'}
                    </button>

                    {lvl < 5 ? (
                      <button
                        type="button"
                        onClick={() => onUpgradeRecipe(recipe.id)}
                        disabled={save.gold < upgradeCost}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white text-xs font-medium rounded whitespace-nowrap shrink-0 font-mono tabular-nums transition-colors cursor-pointer"
                      >
                        升級料理 ({upgradeCost} G)
                      </button>
                    ) : (
                      <span className="text-xs text-amber-400 font-medium whitespace-nowrap shrink-0">
                        已達最高星級
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
};
