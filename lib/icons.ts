/**
 * Centralized icon exports from lucide-react
 * Ensures tree-shaking and avoids duplicate imports across components
 */
export {
  // Navigation
  ArrowLeftRight,
  ChevronRight,
  Menu,
  X,

  // Actions
  Search,
  Filter,
  LogIn,
  LogOut,

  // Status
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  Lock,

  // Decorative
  Award,
  Briefcase,
  Clock,
  Crown,
  Flame,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Tv,
  Users,
  Zap,
} from 'lucide-react';

// Re-export LucideIcon type for components that need it
export type { LucideIcon } from 'lucide-react';
