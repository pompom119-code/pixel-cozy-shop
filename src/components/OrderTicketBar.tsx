import React from 'react';
import { CustomerPhase, LiveCustomer, ShopThemeConfig } from '../types/game';
import { PixelItemIcon } from './PixelSprites';

interface OrderTicketBarProps {
  customers: LiveCustomer[];
  theme: ShopThemeConfig;
  onFocusCustomerTable?: (gx: number, gy: number) => void;
}

export const OrderTicketBar: React.FC<OrderTicketBarProps> = ({
  customers,
  theme,
  onFocusCustomerTable,
}) => {
  const activeOrders = customers.filter(
    (c) => c.phase === CustomerPhase.WAITING_FOOD || c.phase === CustomerPhase.ENTERING
  );

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-3.5">
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <span className="text-xs font-semibold text-stone-300">
          即時點單票券列（流程：拿生食材 → 備料台切碎 → 投入爐鍋煮熟 → 拿乾淨餐盤盛裝 → 端上餐桌）
        </span>
        <span className="text-xs font-mono tabular-nums text-stone-400 shrink-0">
          待出餐：{activeOrders.length} 張
        </span>
      </div>

      {activeOrders.length === 0 ? (
        <div className="py-3 text-xs text-stone-500">
          目前尚無待製作訂單，可趁空檔先切好常用食材放在流理台備用！
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeOrders.map((cust, index) => {
            const recipe = theme.recipes.find((r) => r.id === cust.recipeId);
            if (!recipe) return null;

            const pct = Math.max(0, Math.min(100, Math.round(cust.patienceLeft)));
            const isUrgent = pct < 35;
            const isEarlyBonus = pct >= 65;

            return (
              <button
                key={cust.id}
                type="button"
                onClick={() => onFocusCustomerTable?.(cust.targetGx, cust.targetGy)}
                className={`text-left p-3 rounded-lg border transition-colors flex flex-col justify-between gap-2.5 cursor-pointer ${
                  isUrgent
                    ? 'bg-rose-950/35 border-rose-500/70'
                    : 'bg-stone-950 border-stone-800 hover:border-amber-500/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PixelItemIcon spriteKey={recipe.spriteKey} size={28} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-100 truncate">
                        #{index + 1} {recipe.name}
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        {cust.name} {cust.regularId ? '· 熟客' : ''} ·{' '}
                        <span className="font-mono tabular-nums text-amber-300">
                          {cust.payAmount} G
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step-by-step Required Ingredients */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-stone-800/90">
                  {recipe.ingredients.map((ingId, idx) => {
                    const ing = theme.ingredients.find((i) => i.id === ingId);
                    if (!ing) return null;
                    return (
                      <React.Fragment key={`${ingId}-${idx}`}>
                        {idx > 0 && (
                          <span className="text-xs text-stone-500 font-mono">+</span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-stone-200 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                          <PixelItemIcon spriteKey={ing.spriteKey} size={16} />
                          <span>{ing.shortName}</span>
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Patience Status Text + SVG Bar (zero HTML inline styles!) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span
                      className={
                        isUrgent
                          ? 'text-rose-400 font-semibold'
                          : isEarlyBonus
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }
                    >
                      {isUrgent ? '催單中！' : isEarlyBonus ? '早鳥小費 x1.3' : '耐心等待中'}
                    </span>
                    <span className="text-stone-400">{pct}%</span>
                  </div>
                  <svg
                    viewBox="0 0 100 5"
                    preserveAspectRatio="none"
                    className="w-full h-1.5 rounded overflow-hidden bg-stone-800"
                    aria-hidden="true"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={pct}
                      height={5}
                      fill={isUrgent ? '#F43F5E' : isEarlyBonus ? '#10B981' : '#F59E0B'}
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
