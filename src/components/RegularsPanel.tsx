import React from 'react';
import {
  RegularDef,
  ShopSaveState,
  ShopThemeConfig,
  StoryChapter,
  StoryModalData,
} from '../types/game';
import { PixelCharacterAvatar, PixelItemIcon } from './PixelSprites';

export function getRegularHeartLevel(points: number): number {
  if (points >= 10) return 5;
  if (points >= 7) return 4;
  if (points >= 5) return 3;
  if (points >= 3) return 2;
  if (points >= 1) return 1;
  return 0;
}

interface RegularsPanelProps {
  theme: ShopThemeConfig;
  save: ShopSaveState;
  onReplayChapter: (regular: RegularDef, chapter: StoryChapter) => void;
}

export const RegularsPanel: React.FC<RegularsPanelProps> = ({
  theme,
  save,
  onReplayChapter,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-stone-100">熟客好感圖鑑與溫馨故事</h2>
          <p className="text-xs text-stone-400 mt-1">
            當熟客來店內用餐時會累積好感度；若剛好供應他們最喜愛的料理，好感度將雙倍提升！滿 Lv.1、Lv.3、Lv.5 將解鎖專屬故事劇場與謝禮。
          </p>
        </div>
        <div className="text-xs text-stone-300 font-mono tabular-nums shrink-0">
          已結識熟客：{theme.regulars.filter((r) => (save.regularPoints[r.id] || 0) > 0).length} / {theme.regulars.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {theme.regulars.map((reg) => {
          const pts = save.regularPoints[reg.id] || 0;
          const heartLvl = getRegularHeartLevel(pts);
          const favRecipe = theme.recipes.find((r) => r.id === reg.favoriteRecipeId);
          const isFavUnlocked = favRecipe && save.unlockedRecipes.includes(favRecipe.id);
          const seenChapters = save.unlockedChapters[reg.id] || [];

          return (
            <div
              key={reg.id}
              className="bg-stone-900 border border-stone-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <PixelCharacterAvatar
                    hairColor={reg.spriteHair}
                    outfitColor={reg.spriteOutfit}
                    accessory={reg.accessory}
                    size={52}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg text-stone-100 truncate">{reg.name}</h3>
                      <span className="text-xs font-mono tabular-nums text-rose-300 shrink-0">
                        好感 Lv.{heartLvl}/5
                      </span>
                    </div>
                    <p className="text-xs text-amber-300/90 mt-0.5">{reg.title}</p>
                    <p className="text-xs text-stone-400 font-mono tabular-nums mt-1">
                      累積來訪親密度：{pts} 點
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed">{reg.bio}</p>

                <div className="pt-2 border-t border-stone-800/80 flex items-center gap-2 text-xs text-stone-400">
                  {favRecipe && isFavUnlocked ? (
                    <>
                      <PixelItemIcon spriteKey={favRecipe.spriteKey} size={20} />
                      <span>最愛料理：{favRecipe.name}</span>
                    </>
                  ) : (
                    <span>最愛料理：尚未研發解鎖（{favRecipe?.isSecret ? '傳說隱藏食譜' : '研發菜單'}）</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 space-y-2.5">
                <p className="text-xs text-stone-400">
                  滿好感信物：{heartLvl >= 5 ? `${reg.keepsakeName}（已獲贈 · 店面魅力 +15）` : '？？？ （好感 Lv.5 贈送）'}
                </p>

                <div className="flex flex-wrap gap-2">
                  {reg.chapters.map((ch, idx) => {
                    const unlocked = seenChapters.includes(ch.levelRequired) || heartLvl >= ch.levelRequired;
                    return (
                      <button
                        key={ch.levelRequired}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => onReplayChapter(reg, ch)}
                        className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          unlocked
                            ? 'bg-stone-800 hover:bg-stone-700 text-amber-300 cursor-pointer'
                            : 'bg-stone-950 text-stone-600 cursor-not-allowed'
                        }`}
                      >
                        {unlocked ? `重溫第 ${idx + 1} 話` : `第 ${idx + 1} 話 (Lv.${ch.levelRequired})`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface StoryModalProps {
  modalData: StoryModalData | null;
  theme: ShopThemeConfig;
  onClose: () => void;
}

export const StoryEventModal: React.FC<StoryModalProps> = ({
  modalData,
  theme,
  onClose,
}) => {
  if (!modalData) return null;
  const { regular, chapter, isReplay } = modalData;
  const rewardIng = chapter.rewardIngredientId
    ? theme.ingredients.find((i) => i.id === chapter.rewardIngredientId)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
    >
      <div className="w-full max-w-lg bg-stone-900 border border-amber-500/70 rounded-xl p-6 space-y-5 pixel-shadow">
        <div className="flex items-center gap-4 border-b border-stone-800 pb-4">
          <PixelCharacterAvatar
            hairColor={regular.spriteHair}
            outfitColor={regular.spriteOutfit}
            accessory={regular.accessory}
            size={56}
          />
          <div>
            <p className="text-xs text-amber-400">
              熟客溫馨故事劇場 · {regular.name}（{regular.title}）
            </p>
            <h3 id="story-modal-title" className="font-display text-xl text-stone-100 mt-0.5">
              {chapter.title}
            </h3>
          </div>
        </div>

        <div className="space-y-3 bg-stone-950 border border-stone-800 rounded-lg p-4">
          {chapter.dialogue.map((line, i) => (
            <p key={i} className="text-sm text-stone-200 leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        {!isReplay && (
          <div className="text-xs text-emerald-300 font-mono tabular-nums">
            熟客謝禮：+{chapter.rewardGold} G
            {rewardIng && chapter.rewardIngredientQty
              ? ` · 獲贈「${rewardIng.name}」×${chapter.rewardIngredientQty}`
              : ''}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isReplay ? '關閉回憶' : '收下謝禮並繼續營業'}
          </button>
        </div>
      </div>
    </div>
  );
};
