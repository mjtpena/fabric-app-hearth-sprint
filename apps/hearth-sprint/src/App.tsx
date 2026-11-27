import { Route, Routes } from 'react-router-dom';

import { AboutPage } from './pages/AboutPage';
import { BuddyBenchPage } from './pages/BuddyBenchPage';
import { CardBankPage } from './pages/CardBankPage';
import { FiresideReportPage } from './pages/FiresideReportPage';
import { HomePage } from './pages/HomePage';
import { PokerPage } from './pages/PokerPage';
import { StudyLogPage } from './pages/StudyLogPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/study" element={<StudyLogPage />} />
      <Route path="/poker" element={<PokerPage />} />
      <Route path="/cards" element={<CardBankPage />} />
      <Route path="/bench" element={<BuddyBenchPage />} />
      <Route path="/report" element={<FiresideReportPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}
