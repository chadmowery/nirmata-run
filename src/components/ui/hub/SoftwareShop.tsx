'use client';

import React, { useMemo } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { generateShopStock } from '@/game/systems/shop-rotation';
import { BtnLever } from '../atomic';
import styles from './SoftwareShop.module.css';

export const SoftwareShop: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const shopStock = useMemo(() => {
    if (!profile) return [];
    return generateShopStock(profile.weekSeed);
  }, [profile?.weekSeed]);

  if (!profile) return null;

  const handlePurchase = async (
    itemIndex: number,
    price: number,
    templateId: string,
    rarity: string,
  ) => {
    if (profile.wallet.scrap < price) return;

    try {
      const response = await fetch('/api/economy/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          itemIndex,
          weekSeed: profile.weekSeed,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        updateProfileOptimistic((p) => ({
          ...p,
          wallet: {
            ...p.wallet,
            scrap: data.remainingScrap ?? p.wallet.scrap - price,
          },
          vault: [
            ...p.vault,
            data.vaultItem || {
              entityId: Date.now(),
              templateId,
              rarityTier: rarity,
              itemType: 'software',
              extractedAtFloor: 0,
              extractedAtTimestamp: Date.now(),
            },
          ],
        }));
      }
    } catch (error) {
      logger.error('Purchase failed:', 'UI', error);
    }
  };

  return (
    <div className={styles.shopRoot}>
      <div className={styles.stockList}>
        {shopStock.map((item, index) => {
          const canAfford = profile.wallet.scrap >= item.price;
          return (
            <div key={`${item.templateId}-${index}`} className={styles.card}>
              <div className={styles.info}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.rarity}>
                  TIER: {item.rarity.toUpperCase()} // COST: {item.price} CR
                </span>
              </div>

              <BtnLever
                variant="primary"
                disabled={!canAfford}
                onClick={() => handlePurchase(index, item.price, item.templateId, item.rarity)}
                rightSlot={`${item.price} CR`}
              >
                ACQUIRE
              </BtnLever>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SoftwareShop;
