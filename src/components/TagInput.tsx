// HealthVault — Tag input (free-text entry with removable tags)

import { useState } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Add an item…',
}: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (item: string) => {
    onChange(tags.filter((t) => t !== item));
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={addTag}
          className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg text-sm"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((item) => (
            <span
              key={item}
              className="bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded-md flex items-center gap-1"
            >
              {item}
              <button
                onClick={() => removeTag(item)}
                className="text-surface-500 hover:text-surface-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
