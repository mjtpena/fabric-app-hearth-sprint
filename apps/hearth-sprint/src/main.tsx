import { BookOpen, Flame, FileText, Info, Layers, Sparkles, Users } from 'lucide-react';
import { mountApp } from '@x10/shared/runtime';

import { App } from './App';
import { config } from './app.config';
import './index.css';

const ICONS = [
  <Flame key="hearth" className="h-4 w-4" />,
  <BookOpen key="study" className="h-4 w-4" />,
  <Sparkles key="poker" className="h-4 w-4" />,
  <Layers key="cards" className="h-4 w-4" />,
  <Users key="bench" className="h-4 w-4" />,
  <FileText key="report" className="h-4 w-4" />,
  <Info key="about" className="h-4 w-4" />,
];

const nav = config.nav.map((item, i) => ({
  ...item,
  icon: ICONS[i],
}));

mountApp({ ...config, nav }, <App />);
