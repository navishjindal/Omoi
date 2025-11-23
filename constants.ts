import { AACSymbol, NodeType } from './types';

// Helper to create symbols easily
const createSymbol = (
  id: string,
  label: string,
  emoji: string,
  color: string,
  type: NodeType,
  children?: AACSymbol[],
  keywords: string[] = [],
  relatedIds: string[] = []
): AACSymbol => ({
  id,
  label,
  emoji,
  color,
  type,
  children,
  keywords: [label.toLowerCase(), ...keywords],
  relatedIds,
});

// Color Palette (Pastels for AAC accessibility)
const COLORS = {
  YELLOW: 'bg-amber-100 border-amber-300 hover:bg-amber-200',
  GREEN: 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200',
  BLUE: 'bg-sky-100 border-sky-300 hover:bg-sky-200',
  ORANGE: 'bg-orange-100 border-orange-300 hover:bg-orange-200',
  PURPLE: 'bg-purple-100 border-purple-300 hover:bg-purple-200',
  RED: 'bg-rose-100 border-rose-300 hover:bg-rose-200',
  GRAY: 'bg-slate-100 border-slate-300 hover:bg-slate-200',
  WHITE: 'bg-white border-gray-200 hover:bg-gray-50',
};

export const VOCABULARY: AACSymbol[] = [
  // --- DIRECT NEEDS (Root Level) ---
  
  // CATEGORY: FOOD (Eat)
  createSymbol('cat_food', 'Eat / Drink', '🍔', COLORS.ORANGE, NodeType.CATEGORY, [
    createSymbol('water', 'Water', '💧', COLORS.BLUE, NodeType.ITEM, undefined, [], ['drink']),
    createSymbol('juice', 'Juice', '🧃', COLORS.ORANGE, NodeType.ITEM, undefined, [], ['drink']),
    createSymbol('milk', 'Milk', '🥛', COLORS.WHITE, NodeType.ITEM, undefined, [], ['drink']),
    createSymbol('apple', 'Apple', '🍎', COLORS.RED, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('banana', 'Banana', '🍌', COLORS.YELLOW, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('nuggets', 'Nuggets', '🍗', COLORS.ORANGE, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('pizza', 'Pizza', '🍕', COLORS.ORANGE, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('chips', 'Chips', '🥔', COLORS.YELLOW, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('candy', 'Candy', '🍬', COLORS.PURPLE, NodeType.ITEM, undefined, [], ['eat']),
    createSymbol('hungry', 'Hungry', '😋', COLORS.ORANGE, NodeType.ITEM),
    createSymbol('thirsty', 'Thirsty', '🥤', COLORS.BLUE, NodeType.ITEM),
  ]),

  // CATEGORY: PLAY (Activities)
  createSymbol('cat_play', 'Play', '🛝', COLORS.GREEN, NodeType.CATEGORY, [
    createSymbol('blocks', 'Blocks', '🧱', COLORS.RED, NodeType.ITEM),
    createSymbol('ball', 'Ball', '⚽', COLORS.WHITE, NodeType.ITEM),
    createSymbol('doll', 'Doll', '🎎', COLORS.PURPLE, NodeType.ITEM),
    createSymbol('cars', 'Cars', '🚗', COLORS.BLUE, NodeType.ITEM),
    createSymbol('tablet', 'iPad', '📱', COLORS.GRAY, NodeType.ITEM),
    createSymbol('bubbles', 'Bubbles', '🫧', COLORS.BLUE, NodeType.ITEM),
    createSymbol('music', 'Music', '🎵', COLORS.PURPLE, NodeType.ITEM),
    createSymbol('puzzle', 'Puzzle', '🧩', COLORS.GREEN, NodeType.ITEM),
  ]),

  // CATEGORY: PLACES (Go To...)
  createSymbol('cat_places', 'Go To...', '🚶', COLORS.BLUE, NodeType.CATEGORY, [
    createSymbol('car', 'Car', '🚗', COLORS.GRAY, NodeType.ITEM),
    createSymbol('home', 'Home', '🏠', COLORS.ORANGE, NodeType.ITEM),
    createSymbol('school', 'School', '🏫', COLORS.YELLOW, NodeType.ITEM),
    createSymbol('park', 'Park', '🌳', COLORS.GREEN, NodeType.ITEM),
    createSymbol('outside', 'Outside', '☀️', COLORS.BLUE, NodeType.ITEM),
    createSymbol('grandmas', 'Grandmas', '👵', COLORS.PURPLE, NodeType.ITEM),
    createSymbol('store', 'Store', '🏪', COLORS.BLUE, NodeType.ITEM),
  ]),

  // HIGH PRIORITY ITEMS (Direct Access)
  createSymbol('bathroom', 'Washroom', '🚽', COLORS.WHITE, NodeType.ITEM),
  createSymbol('help', 'Help', '🤝', COLORS.PURPLE, NodeType.ITEM),
  
  // CATEGORY: FEELINGS
  createSymbol('cat_feelings', 'Feelings', '😊', COLORS.YELLOW, NodeType.CATEGORY, [
    createSymbol('happy', 'Happy', '😄', COLORS.GREEN, NodeType.ITEM),
    createSymbol('sad', 'Sad', '😢', COLORS.BLUE, NodeType.ITEM),
    createSymbol('angry', 'Angry', '😡', COLORS.RED, NodeType.ITEM),
    createSymbol('tired', 'Tired', '🥱', COLORS.GRAY, NodeType.ITEM),
    createSymbol('sick', 'Sick', '🤢', COLORS.GREEN, NodeType.ITEM),
    createSymbol('hurt', 'Hurt', '🤕', COLORS.RED, NodeType.ITEM),
  ]),

  // CATEGORY: PEOPLE
  createSymbol('cat_people', 'People', '👨‍👩‍👧', COLORS.YELLOW, NodeType.CATEGORY, [
    createSymbol('mom', 'Mom', '👩', COLORS.YELLOW, NodeType.ITEM),
    createSymbol('dad', 'Dad', '👨', COLORS.YELLOW, NodeType.ITEM),
    createSymbol('teacher', 'Teacher', '🧑‍🏫', COLORS.YELLOW, NodeType.ITEM),
    createSymbol('friend', 'Friend', '🧑‍🤝‍🧑', COLORS.YELLOW, NodeType.ITEM),
  ]),

  // RESPONSES
  createSymbol('yes', 'Yes', '✅', COLORS.GREEN, NodeType.ITEM),
  createSymbol('no', 'No', '❌', COLORS.RED, NodeType.ITEM),
  createSymbol('more', 'More', '➕', COLORS.GRAY, NodeType.ITEM),
  createSymbol('all_done', 'All Done', '🏁', COLORS.GRAY, NodeType.ITEM),
];