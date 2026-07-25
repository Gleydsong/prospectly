import React from 'react';

import { BROWSER_CHROME } from '../config/dimensions';
import { COLORS, FONTS } from '../config/theme';

type BrowserChromeProps = {
  readonly url: string;
  readonly children: React.ReactNode;
  readonly width?: number;
  readonly height?: number;
  readonly scale?: number;
};

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  url,
  children,
  width = BROWSER_CHROME.width,
  height = BROWSER_CHROME.height,
  scale = 1,
}) => {
  const { titleBarHeight, borderRadius, trafficLightSize, trafficLightGap } =
    BROWSER_CHROME;

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        overflow: 'hidden',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        boxShadow: `
          0 40px 100px rgba(0,0,0,0.55),
          0 0 0 1px rgba(255,255,255,0.08)
        `,
        backgroundColor: COLORS.browserChrome,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: titleBarHeight,
          backgroundColor: COLORS.browserBar,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: trafficLightGap }}>
          {(['#ff5f57', '#febc2e', '#28c840'] as const).map((color) => (
            <div
              key={color}
              style={{
                width: trafficLightSize,
                height: trafficLightSize,
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            height: 28,
            borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.35)',
            color: COLORS.zinc400,
            fontFamily: FONTS.sans,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {url}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: COLORS.zinc950,
        }}
      >
        {children}
      </div>
    </div>
  );
};
