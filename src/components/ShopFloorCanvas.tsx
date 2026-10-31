import React, { useState } from 'react';
import { EXPANSION_TIERS, FURNITURE_CATALOG } from '../data/themes';
import {
  BoardState,
  CustomerPhase,
  Direction,
  FloatingEffect,
  HeldItem,
  LiveCustomer,
  PlacedFurniture,
  PlayerChefState,
  ShopThemeConfig,
  SinkState,
  StationKind,
  StoveState,
} from '../types/game';
import { renderHeldItemSvg, renderPixelItemContent } from './PixelSprites';

interface ShopFloorCanvasProps {
  theme: ShopThemeConfig;
  expansionLevel: number;
  minuteOfDay: number;
  placedFurniture: PlacedFurniture[];
  player: PlayerChefState;
  boards: Record<string, BoardState>;
  stoves: Record<string, StoveState>;
  counters: Record<string, HeldItem>;
  cleanPlates: number;
  sink: SinkState;
  dirtyTables: Record<string, boolean>;
  customers: LiveCustomer[];
  effects: FloatingEffect[];
  hiredStaffLevels: Record<string, number>;
  staffAssistEnabled: boolean;
  isBuildMode: boolean;
  isRemoveMode: boolean;
  selectedFurnitureId: string | null;
  onTileClick: (gx: number, gy: number) => void;
  onPlayTileClick: (gx: number, gy: number, mode: 'INTERACT' | 'WORK') => void;
  onManualMoveStep: (dir: Direction) => void;
  onManualInteract: () => void;
  onManualWork: () => void;
}

const TILE = 28;

export function getFrontTile(player: PlayerChefState): { gx: number; gy: number } {
  const rx = Math.round(player.x);
  const ry = Math.round(player.y);
  if (player.facing === 'UP') return { gx: rx, gy: ry - 1 };
  if (player.facing === 'DOWN') return { gx: rx, gy: ry + 1 };
  if (player.facing === 'LEFT') return { gx: rx - 1, gy: ry };
  return { gx: rx + 1, gy: ry };
}

export const ShopFloorCanvas: React.FC<ShopFloorCanvasProps> = ({
  theme,
  expansionLevel,
  minuteOfDay,
  placedFurniture,
  player,
  boards,
  stoves,
  counters,
  cleanPlates,
  sink,
  dirtyTables,
  customers,
  effects,
  hiredStaffLevels,
  staffAssistEnabled,
  isBuildMode,
  isRemoveMode,
  selectedFurnitureId,
  onTileClick,
  onPlayTileClick,
  onManualMoveStep,
  onManualInteract,
  onManualWork,
}) => {
  const [hoverTile, setHoverTile] = useState<{ gx: number; gy: number } | null>(null);

  const tier = EXPANSION_TIERS.find((t) => t.level === expansionLevel) || EXPANSION_TIERS[0];
  const cols = tier.cols;
  const rows = tier.rows;
  const wallHeight = 22;
  const svgWidth = cols * TILE;
  const svgHeight = rows * TILE + wallHeight;

  let windowSkyColor = '#38BDF8';
  if (minuteOfDay >= 1020 && minuteOfDay < 1140) {
    windowSkyColor = '#FB923C';
  } else if (minuteOfDay >= 1140) {
    windowSkyColor = '#1E1B4B';
  }

  const occupiedMap = new Map<string, PlacedFurniture>();
  placedFurniture.forEach((pf) => {
    occupiedMap.set(`${pf.gx},${pf.gy}`, pf);
  });

  const frontTarget = getFrontTile(player);
  const activeStaff = staffAssistEnabled
    ? theme.staffPool.filter((s) => (hiredStaffLevels[s.id] || 0) > 0)
    : [];

  return (
    <div className="space-y-3">
      <div className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 sm:p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          shapeRendering="crispEdges"
          className="w-full h-auto max-h-[560px] pixel-art select-none"
          role="img"
          aria-label={`${theme.title}像素廚房與客席互動地圖`}
        >
          {/* Top Wall Trim */}
          <rect x={0} y={0} width={svgWidth} height={wallHeight} fill={theme.wallColor} />
          <rect x={0} y={wallHeight - 3} width={svgWidth} height={3} fill={theme.trimColor} />

          {/* Wall Windows */}
          {Array.from({ length: Math.floor(cols / 3) }).map((_, idx) => {
            const wx = idx * 3 * TILE + 12;
            return (
              <g key={`win-${idx}`}>
                <rect x={wx} y={3} width={22} height={13} fill="#1C1917" />
                <rect x={wx + 2} y={5} width={8} height={9} fill={windowSkyColor} />
                <rect x={wx + 12} y={5} width={8} height={9} fill={windowSkyColor} />
              </g>
            );
          })}

          {/* Floor Tiles + Row 0 Ingredient Crates */}
          {Array.from({ length: rows }).map((_, gy) =>
            Array.from({ length: cols }).map((__, gx) => {
              const px = gx * TILE;
              const py = wallHeight + gy * TILE;
              const isAlt = (gx + gy) % 2 === 0;
              const isKitchenZone = gy <= 3;
              const isDoorTile = gx === 0 && gy === rows - 1;
              const isCrateSlot = gy === 0 && gx >= 1 && gx <= 8;
              const crateIngredient = isCrateSlot ? theme.ingredients[gx - 1] : undefined;
              const existing = occupiedMap.get(`${gx},${gy}`);
              const isHovered = hoverTile?.gx === gx && hoverTile?.gy === gy;

              let tileFill = isKitchenZone
                ? isAlt
                  ? theme.kitchenFloorPrimary
                  : theme.kitchenFloorSecondary
                : isAlt
                ? theme.floorPrimary
                : theme.floorSecondary;

              if (gy === 0) {
                tileFill = '#292524';
              }

              let buildOverlay: string | null = null;
              if (isBuildMode && isHovered) {
                if (gy === 0 || isDoorTile) {
                  buildOverlay = 'rgba(244, 63, 94, 0.42)';
                } else if (isRemoveMode) {
                  buildOverlay = existing ? 'rgba(244, 63, 94, 0.48)' : 'rgba(148, 163, 184, 0.2)';
                } else if (!existing && selectedFurnitureId) {
                  buildOverlay = 'rgba(52, 211, 153, 0.42)';
                } else {
                  buildOverlay = 'rgba(244, 63, 94, 0.38)';
                }
              }

              return (
                <g
                  key={`tile-${gx}-${gy}`}
                  onClick={() => {
                    if (isBuildMode) {
                      onTileClick(gx, gy);
                    } else {
                      onPlayTileClick(gx, gy, 'INTERACT');
                    }
                  }}
                  onMouseEnter={() => setHoverTile({ gx, gy })}
                  onMouseLeave={() => setHoverTile(null)}
                  className="cursor-pointer"
                >
                  <rect x={px} y={py} width={TILE} height={TILE} fill={tileFill} />
                  {!isKitchenZone && (
                    <rect
                      x={px}
                      y={py + TILE - 1}
                      width={TILE}
                      height={1}
                      fill="rgba(0,0,0,0.18)"
                    />
                  )}

                  {/* Kitchen-to-Dining Divider Strip */}
                  {gy === 3 && (
                    <rect
                      x={px}
                      y={py + TILE - 2}
                      width={TILE}
                      height={2}
                      fill={theme.trimColor}
                    />
                  )}

                  {/* Row 0: Dedicated Pixel Ingredient Crate */}
                  {crateIngredient && (
                    <g transform={`translate(${px}, ${py})`}>
                      <rect x={1} y={2} width={26} height={24} fill="#78350F" />
                      <rect x={2} y={3} width={24} height={15} fill="#B45309" />
                      <rect x={3} y={4} width={22} height={13} fill="#FEF3C7" />
                      <g transform="translate(6, 2) scale(1)">
                        {renderPixelItemContent(crateIngredient.spriteKey)}
                      </g>
                      <rect x={1} y={18} width={26} height={8} fill="#1C1917" />
                      <text
                        x={14}
                        y={24}
                        textAnchor="middle"
                        fill="#FDE68A"
                        fontSize="5.2"
                        fontWeight="bold"
                      >
                        {crateIngredient.shortName}
                      </text>
                    </g>
                  )}

                  {/* Row 0 Corner Wall Cabinets */}
                  {gy === 0 && !crateIngredient && (
                    <g transform={`translate(${px}, ${py})`}>
                      <rect x={2} y={3} width={24} height={22} fill="#44403C" />
                      <rect x={4} y={5} width={20} height={18} fill="#57534E" />
                    </g>
                  )}

                  {/* Entrance Doormat */}
                  {isDoorTile && (
                    <g>
                      <rect x={px + 3} y={py + 6} width={22} height={16} fill="#B45309" />
                      <rect x={px + 5} y={py + 8} width={18} height={12} fill="#F59E0B" />
                    </g>
                  )}

                  {/* Build Mode Grid Overlay */}
                  {isBuildMode && (
                    <rect
                      x={px + 0.5}
                      y={py + 0.5}
                      width={TILE - 1}
                      height={TILE - 1}
                      fill={buildOverlay || 'transparent'}
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="0.6"
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Placed Kitchen Stations, Tables & Decor */}
          {placedFurniture.map((pf) => {
            const itemDef = FURNITURE_CATALOG.find((c) => c.id === pf.itemId);
            if (!itemDef) return null;
            const px = pf.gx * TILE;
            const py = wallHeight + pf.gy * TILE;

            const boardData = boards[pf.uid];
            const stoveData = stoves[pf.uid];
            const counterItem = counters[pf.uid];
            const hasDirtyPlate = dirtyTables[pf.uid];

            return (
              <g
                key={pf.uid}
                transform={`translate(${px}, ${py})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBuildMode) {
                    onTileClick(pf.gx, pf.gy);
                  } else {
                    // Smart click: if cutting board has unchopped raw item or sink has dirty plates while empty-handed, trigger WORK!
                    const shouldWork =
                      (itemDef.stationKind === StationKind.CUTTING_BOARD &&
                        boardData &&
                        !boardData.isPrepped &&
                        !player.held) ||
                      (itemDef.stationKind === StationKind.SINK &&
                        sink.dirtyCount > 0 &&
                        player.held?.kind !== 'DIRTY_PLATE');
                    onPlayTileClick(pf.gx, pf.gy, shouldWork ? 'WORK' : 'INTERACT');
                  }
                }}
                className="cursor-pointer"
              >
                <rect x={3} y={23} width={22} height={3} fill="rgba(0,0,0,0.32)" />
                <g transform="translate(2, 2) scale(1.5)">
                  {renderPixelItemContent(itemDef.spriteKey)}
                </g>

                {/* CUTTING BOARD OVERLAY */}
                {!isBuildMode &&
                  itemDef.stationKind === StationKind.CUTTING_BOARD &&
                  boardData && (
                    <g>
                      <g transform="translate(6, 2) scale(1)">
                        {renderHeldItemSvg(
                          boardData.isPrepped
                            ? { kind: 'PREPPED_INGREDIENT', ingId: boardData.ingId }
                            : { kind: 'RAW_INGREDIENT', ingId: boardData.ingId },
                          theme
                        )}
                      </g>
                      {!boardData.isPrepped && (
                        <g transform="translate(2, -5)">
                          <rect x={0} y={0} width={24} height={5} fill="#0C0A09" />
                          <rect
                            x={1}
                            y={1}
                            width={Math.max(2, Math.round((boardData.chopProgress / 100) * 22))}
                            height={3}
                            fill="#38BDF8"
                          />
                        </g>
                      )}
                    </g>
                  )}

                {/* STOVE / POT OVERLAY (Ingredients + Cook Bar + Anti-Burn Warning!) */}
                {!isBuildMode && itemDef.stationKind === StationKind.STOVE && stoveData && (
                  <g>
                    {/* Ingredient Slots Badge Row */}
                    {stoveData.ingredients.length > 0 && (
                      <g transform="translate(2, 19)">
                        {stoveData.ingredients.map((ingId, idx) => {
                          const ing = theme.ingredients.find((i) => i.id === ingId);
                          return (
                            <g key={`${ingId}-${idx}`} transform={`translate(${idx * 8}, 0)`}>
                              <rect x={0} y={0} width={7} height={7} fill="#0C0A09" stroke="#F59E0B" strokeWidth="0.5" />
                              {ing && (
                                <g transform="scale(0.44)">
                                  {renderPixelItemContent(ing.spriteKey)}
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    )}

                    {/* COOKING Progress */}
                    {stoveData.status === 'COOKING' && (
                      <g transform="translate(2, -6)">
                        <rect x={0} y={0} width={24} height={5} fill="#0C0A09" />
                        <rect
                          x={1}
                          y={1}
                          width={Math.max(2, Math.round((stoveData.cookProgress / 100) * 22))}
                          height={3}
                          fill="#F59E0B"
                        />
                      </g>
                    )}

                    {/* COOKED Ready Check + Anti-Burn Danger Bar! */}
                    {stoveData.status === 'COOKED' && (
                      <g>
                        <g transform="translate(7, -14)">
                          <rect
                            x={0}
                            y={0}
                            width={14}
                            height={8}
                            fill={stoveData.burnProgress > 55 ? '#EF4444' : '#10B981'}
                          />
                          <text
                            x={7}
                            y={6}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="5.2"
                            fontWeight="bold"
                          >
                            {stoveData.burnProgress > 55 ? '快焦!' : '煮熟'}
                          </text>
                        </g>
                        <g transform="translate(2, -5)">
                          <rect x={0} y={0} width={24} height={4} fill="#0C0A09" />
                          <rect
                            x={1}
                            y={1}
                            width={Math.max(1, Math.round(((100 - stoveData.burnProgress) / 100) * 22))}
                            height={2}
                            fill={stoveData.burnProgress > 55 ? '#F43F5E' : '#34D399'}
                          />
                        </g>
                      </g>
                    )}

                    {/* BURNT Ruined Smoke */}
                    {stoveData.status === 'BURNT' && (
                      <g>
                        <g transform="translate(6, 1)">
                          {renderPixelItemContent('ITEM_BURNT')}
                        </g>
                        <g transform="translate(4, -10)">
                          <rect x={0} y={0} width={20} height={8} fill="#1C1917" stroke="#F43F5E" strokeWidth="0.7" />
                          <text x={10} y={6} textAnchor="middle" fill="#FDA4AF" fontSize="5" fontWeight="bold">
                            燒焦了
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                )}

                {/* COUNTER ITEM OVERLAY */}
                {!isBuildMode &&
                  itemDef.stationKind === StationKind.COUNTER &&
                  counterItem && (
                    <g transform="translate(6, 1)">
                      {renderHeldItemSvg(counterItem, theme)}
                    </g>
                  )}

                {/* PLATE RACK COUNT BADGE */}
                {!isBuildMode && itemDef.stationKind === StationKind.PLATE_RACK && (
                  <g transform="translate(15, 0)">
                    <rect x={0} y={0} width={12} height={8} fill="#0F172A" stroke="#94A3B8" strokeWidth="0.6" />
                    <text x={6} y={6} textAnchor="middle" fill="#F8FAFC" fontSize="5.5" fontWeight="bold">
                      {cleanPlates}
                    </text>
                  </g>
                )}

                {/* SINK DIRTY PLATES & WASH PROGRESS */}
                {!isBuildMode && itemDef.stationKind === StationKind.SINK && sink.dirtyCount > 0 && (
                  <g>
                    <g transform="translate(15, 0)">
                      <rect x={0} y={0} width={12} height={8} fill="#7C2D12" stroke="#FDBA74" strokeWidth="0.6" />
                      <text x={6} y={6} textAnchor="middle" fill="#FFEDD5" fontSize="5.5" fontWeight="bold">
                        髒{sink.dirtyCount}
                      </text>
                    </g>
                    {sink.washProgress > 0 && (
                      <g transform="translate(2, -5)">
                        <rect x={0} y={0} width={24} height={4} fill="#0C0A09" />
                        <rect
                          x={1}
                          y={1}
                          width={Math.max(2, Math.round((sink.washProgress / 100) * 22))}
                          height={2}
                          fill="#38BDF8"
                        />
                      </g>
                    )}
                  </g>
                )}

                {/* DIRTY PLATE LEFT ON DINING TABLE */}
                {!isBuildMode && itemDef.stationKind === StationKind.TABLE && hasDirtyPlate && (
                  <g transform="translate(6, 2)">
                    {renderPixelItemContent('ITEM_DIRTY_PLATE')}
                  </g>
                )}
              </g>
            );
          })}

          {/* Front Interaction Reticle in front of Player Chef */}
          {!isBuildMode &&
            frontTarget.gx >= 0 &&
            frontTarget.gx < cols &&
            frontTarget.gy >= 0 &&
            frontTarget.gy < rows && (
              <rect
                x={frontTarget.gx * TILE + 1.5}
                y={wallHeight + frontTarget.gy * TILE + 1.5}
                width={TILE - 3}
                height={TILE - 3}
                fill="none"
                stroke="#FACC15"
                strokeWidth="1.2"
                strokeDasharray="3 2"
                pointerEvents="none"
              />
            )}

          {/* Hired Helper Staff Sprites */}
          {!isBuildMode &&
            activeStaff.map((staff, idx) => {
              let sx = Math.min(cols - 2, 1 + idx * 2) * TILE + 5;
              let sy = wallHeight + TILE + 3;
              if (staff.roleType === 'SERVER') {
                sx = Math.min(cols - 2, 8) * TILE + 5;
                sy = wallHeight + 3 * TILE + 3;
              } else if (staff.roleType === 'HOST') {
                sx = TILE + 5;
                sy = wallHeight + (rows - 1) * TILE + 3;
              }

              return (
                <g key={staff.id} transform={`translate(${sx}, ${sy})`} pointerEvents="none">
                  <rect x={3} y={17} width={12} height={2} fill="rgba(0,0,0,0.35)" />
                  <rect x={4} y={1} width={10} height={3} fill={staff.hatColor} />
                  <rect x={4} y={4} width={10} height={6} fill="#FDE68A" />
                  <rect x={5.5} y={6} width={1.5} height={1.5} fill="#1E293B" />
                  <rect x={11} y={6} width={1.5} height={1.5} fill="#1E293B" />
                  <rect x={3} y={10} width={12} height={7} fill={staff.spriteColor} />
                </g>
              );
            })}

          {/* Seated / Entering Customers */}
          {!isBuildMode &&
            customers.map((cust) => {
              const cx = cust.gx * TILE + 5;
              const cy = wallHeight + cust.gy * TILE - 4;
              const recipe = theme.recipes.find((r) => r.id === cust.recipeId);

              return (
                <g
                  key={cust.id}
                  transform={`translate(${cx}, ${cy})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayTileClick(cust.targetGx, cust.targetGy, 'INTERACT');
                  }}
                  className="cursor-pointer"
                >
                  <rect x={3} y={18} width={12} height={2} fill="rgba(0,0,0,0.35)" />
                  <rect x={4} y={2} width={10} height={4} fill={cust.spriteHair} />
                  <rect x={4} y={6} width={10} height={5} fill="#FDE68A" />
                  <rect x={5.5} y={8} width={1.5} height={1.5} fill="#1E293B" />
                  <rect x={11} y={8} width={1.5} height={1.5} fill="#1E293B" />
                  <rect x={3} y={11} width={12} height={7} fill={cust.spriteOutfit} />

                  {cust.regularId && (
                    <rect x={7} y={-1} width={4} height={2} fill="#FACC15" />
                  )}

                  {/* Desired Dish Bubble */}
                  {cust.phase === CustomerPhase.WAITING_FOOD && recipe && (
                    <g transform="translate(-2, -16)">
                      <rect
                        x={0}
                        y={0}
                        width={22}
                        height={14}
                        fill="#FEF3C7"
                        stroke={cust.patienceLeft < 35 ? '#E11D48' : '#92400E'}
                        strokeWidth="1"
                      />
                      <rect x={9} y={14} width={4} height={2} fill="#FEF3C7" />
                      <g transform="translate(4, 0) scale(0.88)">
                        {renderPixelItemContent(recipe.spriteKey)}
                      </g>
                    </g>
                  )}

                  {/* Eating Progress */}
                  {cust.phase === CustomerPhase.EATING && (
                    <g transform="translate(1, -8)">
                      <rect x={0} y={0} width={16} height={4} fill="#1C1917" />
                      <rect
                        x={1}
                        y={1}
                        width={Math.max(2, Math.round((cust.eatProgress / 100) * 14))}
                        height={2}
                        fill="#34D399"
                      />
                    </g>
                  )}
                </g>
              );
            })}

          {/* Controllable Player Chef Sprite + Held Item Above Head! */}
          {!isBuildMode && (
            <g
              transform={`translate(${player.x * TILE + 5}, ${wallHeight + player.y * TILE - 3})`}
              pointerEvents="none"
            >
              {/* Player Shadow & Ring */}
              <rect x={1} y={18} width={16} height={4} fill="rgba(250, 204, 21, 0.35)" />
              {/* White Chef Toque Hat */}
              <rect x={3} y={-2} width={12} height={4} fill="#FFFFFF" />
              <rect x={4} y={2} width={10} height={2} fill="#E2E8F0" />
              {/* Chef Face */}
              <rect x={4} y={4} width={10} height={6} fill="#FDE68A" />
              {player.facing !== 'UP' && (
                <g>
                  <rect
                    x={player.facing === 'LEFT' ? 4.5 : player.facing === 'RIGHT' ? 7 : 5.5}
                    y={6}
                    width={1.6}
                    height={1.6}
                    fill="#0F172A"
                  />
                  <rect
                    x={player.facing === 'LEFT' ? 8.5 : player.facing === 'RIGHT' ? 11.5 : 10.5}
                    y={6}
                    width={1.6}
                    height={1.6}
                    fill="#0F172A"
                  />
                </g>
              )}
              {/* Chef Coat & Theme Apron */}
              <rect x={3} y={10} width={12} height={8} fill="#F8FAFC" />
              <rect x={5} y={11} width={8} height={7} fill={theme.accentHex} />

              {/* Held Item Bubble Above Chef */}
              {player.held && (
                <g transform="translate(1, -19)">
                  <rect
                    x={-1}
                    y={-1}
                    width={18}
                    height={16}
                    fill="rgba(12, 10, 9, 0.85)"
                    stroke="#FACC15"
                    strokeWidth="0.9"
                  />
                  {renderHeldItemSvg(player.held, theme)}
                </g>
              )}
            </g>
          )}

          {/* Floating Feedback Popups */}
          {effects.map((fx) => {
            const fxX = fx.gx * TILE + 14;
            const fxY = wallHeight + fx.gy * TILE - 6;
            const fill =
              fx.tone === 'GOLD'
                ? '#FDE047'
                : fx.tone === 'HEART'
                ? '#FDA4AF'
                : fx.tone === 'COMBO'
                ? '#6EE7B7'
                : fx.tone === 'WARN'
                ? '#FB7185'
                : '#7DD3FC';

            return (
              <text
                key={fx.id}
                x={fxX}
                y={fxY}
                textAnchor="middle"
                fill={fill}
                fontSize="6.8"
                fontWeight="bold"
                stroke="#0C0A09"
                strokeWidth="0.4"
                pointerEvents="none"
              >
                {fx.text}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Ergonomic Keyboard Hint + Touch / Mouse Gamepad Bar */}
      {!isBuildMode && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 hidden sm:inline">移動控制：</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onManualMoveStep('LEFT')}
                className="w-10 h-10 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-lg font-mono text-sm cursor-pointer"
                aria-label="向左移動"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => onManualMoveStep('UP')}
                className="w-10 h-10 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-lg font-mono text-sm cursor-pointer"
                aria-label="向上移動"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onManualMoveStep('DOWN')}
                className="w-10 h-10 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-lg font-mono text-sm cursor-pointer"
                aria-label="向下移動"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onManualMoveStep('RIGHT')}
                className="w-10 h-10 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-lg font-mono text-sm cursor-pointer"
                aria-label="向右移動"
              >
                →
              </button>
            </div>
            <span className="text-xs text-stone-400 hidden md:inline">
              （支援鍵盤 WASD / 方向鍵，或直接用滑鼠點擊任意工作站自動走過去互動！）
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onManualInteract}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0 pixel-shadow-sm cursor-pointer"
            >
              拿取 / 放下 / 上菜 (Space)
            </button>
            <button
              type="button"
              onClick={onManualWork}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-stone-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0 pixel-shadow-sm cursor-pointer"
            >
              切菜備料 / 洗碗 (F)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
