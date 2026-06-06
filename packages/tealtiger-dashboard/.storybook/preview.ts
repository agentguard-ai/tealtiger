import type { Preview } from '@storybook/react-vite';

import '../src/styles.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dashboard dark',
      values: [
        { name: 'dashboard dark', value: '#071014' },
        { name: 'dashboard light', value: '#f6f8fa' },
      ],
    },
    layout: 'fullscreen',
  },
};

export default preview;
