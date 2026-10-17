import { FC } from 'react';

// OfficeActor's oA* mark (FE/public/assets/oa-mark.svg in OfficeActor's
// repository). The viewBox frames only the letters "oA"; the star overflows
// to the top right. Layouts therefore center the letters, which is where the
// eye expects the middle: centering the whole artwork shifts "oA" to the left.
const LETTERS_WIDTH = 79.99;
const LETTERS_HEIGHT = 53.84;

export const OfficeActorMark: FC<{ width?: number }> = ({ width = 44 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`28.32 47.29 ${LETTERS_WIDTH} ${LETTERS_HEIGHT}`}
    width={width}
    height={(width * LETTERS_HEIGHT) / LETTERS_WIDTH}
    overflow="visible"
    fill="#e91e63"
    role="img"
    aria-label="OfficeActor"
  >
    <g>
      <path d="M49.52,58.72c-11.69,0-21.2,9.51-21.2,21.2s9.51,21.2,21.2,21.2,21.2-9.51,21.2-21.2-9.51-21.2-21.2-21.2ZM66.84,79.92c0,9.55-7.77,17.32-17.32,17.32s-17.32-7.77-17.32-17.32,7.77-17.32,17.32-17.32,17.32,7.77,17.32,17.32Z" />
      <path d="M69.12,99.45l3.48,1.68,4-10.8h24.05l4.19,10.79,3.47-1.67-19.6-52.16-19.6,52.16ZM78.03,86.47l10.68-28.4,10.43,28.4h-21.11Z" />
    </g>
    <path d="M127.13,50.61c-.47-.06-.94-.12-1.41-.17-1.9-.23-3.87-.46-5.71-.94-3.96-1.03-5.57-2.72-6.6-6.96-.42-1.72-.66-3.53-.9-5.27l-.12-.83-.48-1.73-.27,2.35c-.26,2.27-.53,4.62-1.18,6.78-1.42,4.69-4.57,5.6-8.87,6.36l-6.42.96,2.02.26c.48.06.97.12,1.45.18,1.93.23,3.92.47,5.79.97,3.91,1.05,5.5,2.78,6.53,7.11.41,1.74.66,3.56.89,5.32l.4,2.94.29-1.96c.09-.63.17-1.27.25-1.9.12-.92.24-1.87.4-2.8.65-3.78,1.45-6.79,5.21-8.3,2.08-.84,4.39-1.16,6.62-1.48.72-.1,1.43-.2,2.13-.32l1.89-.31-1.9-.24Z" />
  </svg>
);
