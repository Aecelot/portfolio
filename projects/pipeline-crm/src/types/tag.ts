export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: any;
  createdBy: string;
}

export const TAG_COLORS = [
  { name: 'Red', value: 'red', bg: 'bg-red-100', text: 'text-red-800', dark: 'dark:bg-red-900 dark:text-red-200' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-100', text: 'text-orange-800', dark: 'dark:bg-orange-900 dark:text-orange-200' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-800', dark: 'dark:bg-yellow-900 dark:text-yellow-200' },
  { name: 'Green', value: 'green', bg: 'bg-green-100', text: 'text-green-800', dark: 'dark:bg-green-900 dark:text-green-200' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-100', text: 'text-blue-800', dark: 'dark:bg-blue-900 dark:text-blue-200' },
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', dark: 'dark:bg-indigo-900 dark:text-indigo-200' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-100', text: 'text-purple-800', dark: 'dark:bg-purple-900 dark:text-purple-200' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-100', text: 'text-pink-800', dark: 'dark:bg-pink-900 dark:text-pink-200' },
  { name: 'Gray', value: 'gray', bg: 'bg-gray-100', text: 'text-gray-800', dark: 'dark:bg-gray-800 dark:text-gray-200' },
] as const;

export type TagColor = typeof TAG_COLORS[number]['value'];

export const getTagColorClasses = (color: string): string => {
  const tagColor = TAG_COLORS.find(c => c.value === color);
  if (tagColor) {
    return `${tagColor.bg} ${tagColor.text} ${tagColor.dark}`;
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
};
