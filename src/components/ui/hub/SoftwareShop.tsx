import React, { useMemo } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { generateShopStock } from '@/game/systems/shop-rotation';
import styles from './SoftwareShop.module.css';

const SoftwareShop: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const shopStock = useMemo(() => {
    if (!profile) return [];
    return generateShopStock(profile.weekSeed);
  }, [profile?.weekSeed]);

  if (!profile) return null;

  const handlePurchase = async (itemIndex: number, price: number, templateId: string, rarity: string) => {
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
        
        // Optimistic update using server data if available
        updateProfileOptimistic((p) => ({
          ...p,
          wallet: {
            ...p.wallet,
            scrap: data.remainingScrap ?? (p.wallet.scrap - price),
          },
          vault: [
            ...p.vault,
            data.vaultItem || {
              entityId: Date.now(), // Fallback (shouldn't happen with updated API)
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
      console.error('Purchase failed:', error);
    }
  };

  return (
    <div className={styles.shopRoot}>
      <h3 className={styles.heading}>SOFTWARE_REQUISITION</h3>
      <div className={styles.stockRow}>
        {shopStock.map((item, index) => {
          const canAfford = profile.wallet.scrap >= item.price;
          return (
            <div key={`${item.templateId}-${index}`} className={styles.card}>
              <div className={styles.rarityBadge} data-rarity={item.rarity}>
                {item.rarity.toUpperCase()}
              </div>
              <div className={styles.itemName}>{item.name}</div>
              <div className={styles.price}>
                <span className={!canAfford ? styles.priceInsufficient : ''}>
                  {item.price} SCRAP
                </span>
              </div>
              <button
                className={`${styles.buyButton} ${!canAfford ? styles.buyButtonDisabled : ''}`}
                disabled={!canAfford}
                onClick={() => handlePurchase(index, item.price, item.templateId, item.rarity)}
              >
                ACQUIRE_SOFTWARE
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SoftwareShop;
