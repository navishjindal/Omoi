export enum NodeType {
  CATEGORY = 'CATEGORY',
  ITEM = 'ITEM',
}

export interface AACSymbol {
  id: string;
  label: string;
  emoji: string; // Using emojis for scalable, lightweight icons
  color: string; // Tailwind background color class
  type: NodeType;
  keywords?: string[]; // For AI matching
  children?: AACSymbol[]; // If category
  parentId?: string;
  relatedIds?: string[]; // IDs of symbols that usually follow this one (for smart suggestions)
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface AppState {
  view: 'landing' | 'board';
  currentCategoryId: string | null;
  sentence: AACSymbol[];
  isListening: boolean;
  isSpeaking: boolean;
}