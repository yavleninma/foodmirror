import { useState, useCallback, useEffect } from 'react';
import { useApiInit } from './hooks/useApi';
import { MainScreen } from './screens/MainScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { StatsScreen } from './screens/StatsScreen';
import { BottomNav, type Tab } from './components/BottomNav';

export default function App() {
  const { isInTelegram } = useApiInit();
  const [tab, setTab] = useState<Tab>('main');
  const canUsePersonalFeatures = isInTelegram;

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next);
  }, []);

  useEffect(() => {
    if (!canUsePersonalFeatures && tab !== 'main') {
      setTab('main');
    }
  }, [canUsePersonalFeatures, tab]);

  return (
    <div
      className="flex flex-col bg-[var(--color-bg)]"
      style={{
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'main' && <MainScreen showStreak={canUsePersonalFeatures} />}
        {canUsePersonalFeatures && tab === 'history' && <HistoryScreen />}
        {canUsePersonalFeatures && tab === 'stats' && <StatsScreen />}
      </div>
      {canUsePersonalFeatures && <BottomNav active={tab} onChange={handleTabChange} />}
    </div>
  );
}
