import React from 'react';
import { HeldItem, ShopThemeConfig } from '../types/game';

interface SpriteIconProps {
  spriteKey: string;
  size?: number;
  className?: string;
}

export const PixelItemIcon: React.FC<SpriteIconProps> = ({
  spriteKey,
  size = 36,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${className}`}
      aria-hidden="true"
    >
      {renderPixelItemContent(spriteKey)}
    </svg>
  );
};

export function renderHeldItemSvg(held: HeldItem, theme: ShopThemeConfig): React.ReactNode {
  if (held.kind === 'RAW_INGREDIENT') {
    const ing = theme.ingredients.find((i) => i.id === held.ingId);
    return (
      <g>
        {ing ? renderPixelItemContent(ing.spriteKey) : null}
      </g>
    );
  }
  if (held.kind === 'PREPPED_INGREDIENT') {
    const ing = theme.ingredients.find((i) => i.id === held.ingId);
    return (
      <g>
        <rect x="2" y="11" width="12" height="3" fill="#FEF3C7" />
        <g transform="translate(1, -1) scale(0.88)">
          {ing ? renderPixelItemContent(ing.spriteKey) : null}
        </g>
        {/* Crisp green prepped badge */}
        <rect x="11" y="1" width="4" height="4" fill="#10B981" />
        <rect x="12" y="2" width="2" height="2" fill="#ECFDF5" />
      </g>
    );
  }
  if (held.kind === 'CLEAN_PLATE') {
    return renderPixelItemContent('ITEM_CLEAN_PLATE');
  }
  if (held.kind === 'DIRTY_PLATE') {
    return renderPixelItemContent('ITEM_DIRTY_PLATE');
  }
  if (held.kind === 'BURNT_FOOD') {
    return renderPixelItemContent('ITEM_BURNT');
  }
  if (held.kind === 'PLATED_DISH') {
    return (
      <g>
        <rect x="1" y="11" width="14" height="3" fill="#F8FAFC" />
        <rect x="3" y="14" width="10" height="1" fill="#CBD5E1" />
        <g transform="translate(1, -1) scale(0.9)">
          {renderPixelItemContent(held.spriteKey)}
        </g>
      </g>
    );
  }
  return null;
}

export function renderPixelItemContent(spriteKey: string): React.ReactNode {
  switch (spriteKey) {
    // OVERCOOKED KITCHEN STATIONS
    case 'STATION_BOARD':
      return (
        <g>
          <rect x="1" y="3" width="14" height="12" fill="#78350F" />
          <rect x="2" y="4" width="12" height="7" fill="#D97706" />
          {/* Wooden cutting board + pixel chef knife */}
          <rect x="3" y="5" width="7" height="5" fill="#FDE68A" />
          <rect x="11" y="5" width="2" height="3" fill="#E2E8F0" />
          <rect x="11" y="8" width="2" height="2" fill="#1E293B" />
        </g>
      );
    case 'STATION_COUNTER':
      return (
        <g>
          <rect x="1" y="3" width="14" height="12" fill="#57534E" />
          <rect x="2" y="4" width="12" height="6" fill="#E7E5E4" />
          <rect x="3" y="11" width="10" height="3" fill="#44403C" />
        </g>
      );
    case 'STATION_PLATES':
      return (
        <g>
          <rect x="1" y="4" width="14" height="11" fill="#57534E" />
          <rect x="2" y="5" width="12" height="5" fill="#A8A29E" />
          {/* Stacked white plates */}
          <rect x="4" y="6" width="8" height="2" fill="#F8FAFC" />
          <rect x="4" y="3" width="8" height="2" fill="#FFFFFF" />
          <rect x="5" y="1" width="6" height="2" fill="#E2E8F0" />
        </g>
      );
    case 'STATION_SINK':
      return (
        <g>
          <rect x="1" y="3" width="14" height="12" fill="#475569" />
          <rect x="2" y="4" width="12" height="7" fill="#94A3B8" />
          <rect x="3" y="5" width="10" height="5" fill="#0284C7" />
          <rect x="4" y="6" width="3" height="2" fill="#7DD3FC" />
          {/* Faucet */}
          <rect x="7" y="1" width="3" height="3" fill="#E2E8F0" />
          <rect x="9" y="2" width="1" height="2" fill="#38BDF8" />
        </g>
      );
    case 'STATION_TRASH':
      return (
        <g>
          <rect x="3" y="4" width="10" height="11" fill="#334155" />
          <rect x="2" y="2" width="12" height="2" fill="#64748B" />
          <rect x="6" y="1" width="4" height="1" fill="#94A3B8" />
          <rect x="5" y="6" width="1" height="7" fill="#1E293B" />
          <rect x="8" y="6" width="1" height="7" fill="#1E293B" />
          <rect x="10" y="6" width="1" height="7" fill="#1E293B" />
        </g>
      );
    case 'ITEM_CLEAN_PLATE':
      return (
        <g>
          <rect x="2" y="5" width="12" height="7" fill="#F8FAFC" />
          <rect x="4" y="4" width="8" height="9" fill="#FFFFFF" />
          <rect x="5" y="6" width="6" height="5" fill="#E2E8F0" />
        </g>
      );
    case 'ITEM_DIRTY_PLATE':
      return (
        <g>
          <rect x="2" y="5" width="12" height="7" fill="#D6D3D1" />
          <rect x="4" y="4" width="8" height="9" fill="#E7E5E4" />
          <rect x="5" y="6" width="3" height="3" fill="#92400E" />
          <rect x="8" y="8" width="3" height="2" fill="#78350F" />
        </g>
      );
    case 'ITEM_BURNT':
      return (
        <g>
          <rect x="3" y="7" width="10" height="6" fill="#1C1917" />
          <rect x="5" y="5" width="6" height="3" fill="#292524" />
          <rect x="6" y="2" width="1" height="3" fill="#78716C" />
          <rect x="9" y="1" width="1" height="3" fill="#78716C" />
        </g>
      );

    // DINING & DECOR FURNITURE
    case 'TABLE_COZY':
      return (
        <g>
          <rect x="2" y="11" width="2" height="4" fill="#451A03" />
          <rect x="12" y="11" width="2" height="4" fill="#451A03" />
          <rect x="6" y="10" width="4" height="5" fill="#78350F" />
          <rect x="2" y="5" width="12" height="5" fill="#B45309" />
          <rect x="3" y="6" width="10" height="3" fill="#D97706" />
          <rect x="6" y="6" width="4" height="2" fill="#FEF3C7" />
        </g>
      );
    case 'TABLE_BOOTH':
      return (
        <g>
          <rect x="1" y="4" width="3" height="10" fill="#9F1239" />
          <rect x="12" y="4" width="3" height="10" fill="#9F1239" />
          <rect x="2" y="5" width="2" height="8" fill="#FB7185" />
          <rect x="12" y="5" width="2" height="8" fill="#FB7185" />
          <rect x="4" y="6" width="8" height="4" fill="#92400E" />
          <rect x="5" y="7" width="6" height="2" fill="#FDE68A" />
          <rect x="7" y="10" width="2" height="4" fill="#451A03" />
        </g>
      );
    case 'STOVE_BASIC':
      return (
        <g>
          <rect x="1" y="4" width="14" height="11" fill="#334155" />
          <rect x="2" y="5" width="12" height="4" fill="#64748B" />
          {/* Cooking Pot on Top */}
          <rect x="4" y="2" width="8" height="5" fill="#DC2626" />
          <rect x="3" y="3" width="1" height="2" fill="#991B1B" />
          <rect x="12" y="3" width="1" height="2" fill="#991B1B" />
          <rect x="4" y="10" width="8" height="4" fill="#0F172A" />
          <rect x="5" y="11" width="6" height="2" fill="#F97316" />
        </g>
      );
    case 'STOVE_MASTER':
      return (
        <g>
          <rect x="1" y="4" width="14" height="11" fill="#78350F" />
          <rect x="2" y="5" width="12" height="4" fill="#D97706" />
          {/* Copper Pot on Top */}
          <rect x="4" y="2" width="8" height="5" fill="#F59E0B" />
          <rect x="5" y="3" width="6" height="2" fill="#FEF08A" />
          <rect x="4" y="10" width="8" height="4" fill="#1C1917" />
          <rect x="5" y="11" width="6" height="2" fill="#FBBF24" />
        </g>
      );
    case 'DECOR_PLANT':
      return (
        <g>
          <rect x="5" y="10" width="6" height="5" fill="#C2410C" />
          <rect x="4" y="9" width="8" height="2" fill="#EA580C" />
          <rect x="6" y="4" width="4" height="5" fill="#15803D" />
          <rect x="3" y="5" width="3" height="3" fill="#22C55E" />
          <rect x="10" y="4" width="3" height="4" fill="#22C55E" />
          <rect x="7" y="2" width="3" height="3" fill="#4ADE80" />
        </g>
      );
    case 'DECOR_MUSIC':
      return (
        <g>
          <rect x="4" y="9" width="8" height="6" fill="#78350F" />
          <rect x="5" y="10" width="6" height="4" fill="#92400E" />
          <rect x="7" y="6" width="2" height="3" fill="#CA8A04" />
          <rect x="6" y="2" width="6" height="5" fill="#FACC15" />
          <rect x="8" y="3" width="3" height="3" fill="#FEF08A" />
        </g>
      );
    case 'DECOR_BOOK':
      return (
        <g>
          <rect x="2" y="2" width="12" height="13" fill="#78350F" />
          <rect x="3" y="3" width="10" height="4" fill="#451A03" />
          <rect x="4" y="4" width="2" height="3" fill="#EF4444" />
          <rect x="6" y="4" width="2" height="3" fill="#3B82F6" />
          <rect x="8" y="4" width="3" height="3" fill="#10B981" />
          <rect x="3" y="9" width="10" height="4" fill="#451A03" />
          <rect x="4" y="10" width="3" height="3" fill="#F59E0B" />
          <rect x="8" y="10" width="2" height="3" fill="#A855F7" />
        </g>
      );
    case 'DECOR_HEARTH':
      return (
        <g>
          <rect x="2" y="3" width="12" height="12" fill="#991B1B" />
          <rect x="1" y="2" width="14" height="2" fill="#78350F" />
          <rect x="4" y="7" width="8" height="8" fill="#1C1917" />
          <rect x="5" y="9" width="6" height="5" fill="#EA580C" />
          <rect x="6" y="10" width="4" height="4" fill="#FACC15" />
        </g>
      );
    case 'DECOR_MASCOT':
      return (
        <g>
          <rect x="3" y="12" width="10" height="3" fill="#B45309" />
          <rect x="4" y="5" width="8" height="7" fill="#FDE047" />
          <rect x="4" y="3" width="2" height="2" fill="#FACC15" />
          <rect x="10" y="3" width="2" height="2" fill="#FACC15" />
          <rect x="6" y="7" width="1" height="1" fill="#1E293B" />
          <rect x="9" y="7" width="1" height="1" fill="#1E293B" />
          <rect x="6" y="9" width="4" height="2" fill="#EF4444" />
        </g>
      );

    // DISHES
    case 'DISH_COFFEE':
      return (
        <g>
          <rect x="4" y="6" width="7" height="7" fill="#F8FAFC" />
          <rect x="11" y="7" width="2" height="4" fill="#CBD5E1" />
          <rect x="5" y="7" width="5" height="2" fill="#78350F" />
          <rect x="3" y="13" width="9" height="1" fill="#94A3B8" />
          <rect x="6" y="2" width="1" height="3" fill="#E2E8F0" />
          <rect x="8" y="3" width="1" height="2" fill="#E2E8F0" />
        </g>
      );
    case 'DISH_BREAD':
      return (
        <g>
          <rect x="2" y="11" width="12" height="2" fill="#E2E8F0" />
          <rect x="3" y="7" width="10" height="4" fill="#D97706" />
          <rect x="4" y="5" width="8" height="3" fill="#F59E0B" />
          <rect x="6" y="6" width="4" height="2" fill="#FDE68A" />
        </g>
      );
    case 'DISH_TEA':
      return (
        <g>
          <rect x="4" y="6" width="8" height="7" fill="#ECFDF5" />
          <rect x="5" y="7" width="6" height="3" fill="#10B981" />
          <rect x="6" y="3" width="1" height="2" fill="#A7F3D0" />
          <rect x="9" y="2" width="1" height="3" fill="#A7F3D0" />
          <rect x="3" y="13" width="10" height="1" fill="#6EE7B7" />
        </g>
      );
    case 'DISH_PASTRY':
      return (
        <g>
          <rect x="2" y="11" width="12" height="2" fill="#F1F5F9" />
          <rect x="3" y="6" width="10" height="5" fill="#F59E0B" />
          <rect x="5" y="5" width="6" height="2" fill="#FBBF24" />
          <rect x="7" y="4" width="2" height="2" fill="#FEF08A" />
        </g>
      );
    case 'DISH_CAKE':
      return (
        <g>
          <rect x="2" y="12" width="12" height="2" fill="#CBD5E1" />
          <rect x="4" y="7" width="8" height="5" fill="#FEF2F2" />
          <rect x="4" y="9" width="8" height="1" fill="#FDA4AF" />
          <rect x="7" y="4" width="2" height="3" fill="#E11D48" />
          <rect x="6" y="6" width="4" height="1" fill="#FFFFFF" />
        </g>
      );
    case 'DISH_ROLL':
      return (
        <g>
          <rect x="2" y="11" width="12" height="2" fill="#94A3B8" />
          <rect x="4" y="6" width="8" height="5" fill="#78350F" />
          <rect x="6" y="7" width="4" height="3" fill="#FEF3C7" />
          <rect x="7" y="8" width="2" height="1" fill="#92400E" />
        </g>
      );
    case 'DISH_RAMEN':
      return (
        <g>
          <rect x="2" y="8" width="12" height="5" fill="#DC2626" />
          <rect x="4" y="13" width="8" height="1" fill="#991B1B" />
          <rect x="3" y="6" width="10" height="2" fill="#FDE68A" />
          <rect x="5" y="5" width="3" height="2" fill="#F97316" />
          <rect x="9" y="5" width="2" height="2" fill="#FFFFFF" />
          <rect x="6" y="2" width="1" height="2" fill="#E2E8F0" />
          <rect x="9" y="1" width="1" height="3" fill="#E2E8F0" />
        </g>
      );
    case 'DISH_POTION_RED':
      return (
        <g>
          <rect x="6" y="2" width="4" height="2" fill="#B45309" />
          <rect x="7" y="4" width="2" height="3" fill="#E2E8F0" />
          <rect x="4" y="7" width="8" height="7" fill="#E11D48" />
          <rect x="5" y="8" width="2" height="3" fill="#FDA4AF" />
        </g>
      );
    case 'DISH_POTION_BLUE':
      return (
        <g>
          <rect x="6" y="2" width="4" height="2" fill="#B45309" />
          <rect x="7" y="4" width="2" height="3" fill="#E2E8F0" />
          <rect x="4" y="7" width="8" height="7" fill="#4F46E5" />
          <rect x="5" y="8" width="2" height="3" fill="#A5B4FC" />
        </g>
      );
    case 'DISH_POTION_GREEN':
      return (
        <g>
          <rect x="6" y="2" width="4" height="2" fill="#B45309" />
          <rect x="7" y="4" width="2" height="3" fill="#E2E8F0" />
          <rect x="4" y="7" width="8" height="7" fill="#059669" />
          <rect x="5" y="8" width="2" height="3" fill="#6EE7B7" />
        </g>
      );
    case 'DISH_POTION_GOLD':
      return (
        <g>
          <rect x="6" y="2" width="4" height="2" fill="#92400E" />
          <rect x="7" y="4" width="2" height="3" fill="#FEF3C7" />
          <rect x="4" y="7" width="8" height="7" fill="#F59E0B" />
          <rect x="5" y="8" width="3" height="3" fill="#FEF08A" />
        </g>
      );
    case 'DISH_SECRET_1':
      return (
        <g>
          <rect x="5" y="12" width="6" height="2" fill="#F59E0B" />
          <rect x="7" y="10" width="2" height="2" fill="#FBBF24" />
          <rect x="4" y="5" width="8" height="5" fill="#A855F7" />
          <rect x="5" y="3" width="6" height="3" fill="#F472B6" />
          <rect x="7" y="1" width="2" height="2" fill="#FEF08A" />
        </g>
      );
    case 'DISH_SECRET_2':
      return (
        <g>
          <rect x="2" y="11" width="12" height="3" fill="#F59E0B" />
          <rect x="3" y="6" width="10" height="5" fill="#7C2D12" />
          <rect x="5" y="4" width="6" height="3" fill="#EF4444" />
          <rect x="7" y="2" width="2" height="2" fill="#FEF08A" />
          <rect x="4" y="7" width="2" height="2" fill="#FDE047" />
          <rect x="10" y="7" width="2" height="2" fill="#FDE047" />
        </g>
      );

    // INGREDIENTS
    case 'ING_FLOUR':
      return (
        <g>
          <rect x="4" y="4" width="8" height="10" fill="#E7E5E4" />
          <rect x="5" y="3" width="6" height="2" fill="#D6D3D1" />
          <rect x="6" y="7" width="4" height="4" fill="#F59E0B" />
        </g>
      );
    case 'ING_MILK':
      return (
        <g>
          <rect x="5" y="2" width="6" height="2" fill="#38BDF8" />
          <rect x="4" y="4" width="8" height="10" fill="#F8FAFC" />
          <rect x="5" y="7" width="6" height="4" fill="#BAE6FD" />
        </g>
      );
    case 'ING_BUTTER':
      return (
        <g>
          <rect x="2" y="10" width="12" height="2" fill="#CBD5E1" />
          <rect x="4" y="6" width="8" height="4" fill="#FACC15" />
          <rect x="5" y="7" width="4" height="2" fill="#FEF08A" />
        </g>
      );
    case 'ING_BEAN':
      return (
        <g>
          <rect x="4" y="4" width="8" height="8" fill="#78350F" />
          <rect x="7" y="5" width="2" height="6" fill="#451A03" />
        </g>
      );
    case 'ING_BERRY':
      return (
        <g>
          <rect x="6" y="3" width="4" height="2" fill="#22C55E" />
          <rect x="4" y="5" width="8" height="7" fill="#E11D48" />
          <rect x="6" y="12" width="4" height="2" fill="#BE123C" />
          <rect x="6" y="7" width="1" height="1" fill="#FFE4E6" />
          <rect x="9" y="8" width="1" height="1" fill="#FFE4E6" />
        </g>
      );
    case 'ING_HERB':
      return (
        <g>
          <rect x="7" y="9" width="2" height="5" fill="#15803D" />
          <rect x="4" y="5" width="4" height="5" fill="#22C55E" />
          <rect x="8" y="4" width="4" height="5" fill="#4ADE80" />
          <rect x="6" y="2" width="4" height="3" fill="#86EFAC" />
        </g>
      );
    case 'ING_SHROOM':
      return (
        <g>
          <rect x="6" y="9" width="4" height="5" fill="#E2E8F0" />
          <rect x="3" y="4" width="10" height="5" fill="#6366F1" />
          <rect x="5" y="5" width="2" height="2" fill="#E0E7FF" />
          <rect x="10" y="6" width="2" height="2" fill="#E0E7FF" />
        </g>
      );
    case 'ING_STAR':
      return (
        <g>
          <rect x="7" y="2" width="2" height="12" fill="#FACC15" />
          <rect x="2" y="7" width="12" height="2" fill="#FACC15" />
          <rect x="5" y="5" width="6" height="6" fill="#FEF08A" />
        </g>
      );
    case 'ING_HONEY':
      return (
        <g>
          <rect x="5" y="3" width="6" height="2" fill="#92400E" />
          <rect x="4" y="5" width="8" height="9" fill="#F59E0B" />
          <rect x="5" y="7" width="6" height="4" fill="#FDE047" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="4" y="4" width="8" height="9" fill="#C084FC" />
          <rect x="6" y="2" width="4" height="2" fill="#FACC15" />
          <rect x="6" y="6" width="4" height="4" fill="#FEF08A" />
        </g>
      );
  }
}

interface CharacterPortraitProps {
  hairColor: string;
  outfitColor: string;
  accessory?: string;
  size?: number;
}

export const PixelCharacterAvatar: React.FC<CharacterPortraitProps> = ({
  hairColor,
  outfitColor,
  accessory,
  size = 48,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixel-art shrink-0 bg-stone-900/80 rounded border border-stone-700"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="8" height="6" fill={hairColor} />
      {accessory === 'WITCH_HAT' && (
        <g>
          <rect x="2" y="3" width="12" height="1" fill="#4C1D95" />
          <rect x="5" y="1" width="6" height="2" fill="#6D28D9" />
        </g>
      )}
      {accessory === 'CAP' && <rect x="4" y="2" width="9" height="2" fill="#D97706" />}
      {accessory === 'FLOWER' && <rect x="10" y="2" width="3" height="3" fill="#FB7185" />}
      <rect x="5" y="5" width="6" height="5" fill="#FDE68A" />
      <rect x="6" y="7" width="1" height="1" fill="#1E293B" />
      <rect x="9" y="7" width="1" height="1" fill="#1E293B" />
      {accessory === 'GLASSES' && (
        <g>
          <rect x="5" y="6" width="3" height="3" fill="none" stroke="#38BDF8" strokeWidth="0.8" />
          <rect x="8" y="6" width="3" height="3" fill="none" stroke="#38BDF8" strokeWidth="0.8" />
        </g>
      )}
      {accessory === 'HEADPHONES' && (
        <g>
          <rect x="3" y="5" width="2" height="4" fill="#38BDF8" />
          <rect x="11" y="5" width="2" height="4" fill="#38BDF8" />
        </g>
      )}
      <rect x="4" y="10" width="8" height="5" fill={outfitColor} />
      {accessory === 'SCARF' && <rect x="4" y="10" width="8" height="2" fill="#F43F5E" />}
    </svg>
  );
};
