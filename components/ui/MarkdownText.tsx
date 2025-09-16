import React from 'react';
import { Text, TextStyle } from 'react-native';

interface MarkdownTextProps {
  text: string;
  color?: string;
  codeBg?: string;
  codeColor?: string;
}

// Minimal markdown renderer for bold, italics, and inline code
// Supports: **bold**, __bold__, *italic*, _italic_, `code`
export const MarkdownText: React.FC<MarkdownTextProps> = ({ text, color, codeBg = '#222', codeColor = '#fff' }) => {
  const renderWithItalics = (input: string, baseKey: string) => {
    const elements: React.ReactNode[] = [];
    const italicRegex = /(\*|_)(.+?)\1/g; // *text* or _text_
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = italicRegex.exec(input)) !== null) {
      const [full, _wrapper, inner] = match;
      const start = match.index;
      // preceding text
      if (start > lastIndex) {
        elements.push(
          <Text key={`${baseKey}-i-pre-${idx}`} style={{ color }}>
            {input.slice(lastIndex, start)}
          </Text>
        );
      }
      // italic text
      elements.push(
        <Text key={`${baseKey}-i-${idx}`} style={{ fontStyle: 'italic', color }}>
          {inner}
        </Text>
      );
      lastIndex = start + full.length;
      idx++;
    }

    // tail text
    if (lastIndex < input.length) {
      elements.push(
        <Text key={`${baseKey}-i-tail`} style={{ color }}>
          {input.slice(lastIndex)}
        </Text>
      );
    }

    return elements;
  };

  const renderWithBold = (input: string, baseKey: string) => {
    const elements: React.ReactNode[] = [];
    const boldRegex = /(\*\*|__)(.+?)\1/g; // **text** or __text__
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = boldRegex.exec(input)) !== null) {
      const [full, _wrapper, inner] = match;
      const start = match.index;
      // preceding text (may contain italics)
      if (start > lastIndex) {
        const pre = input.slice(lastIndex, start);
        elements.push(
          <Text key={`${baseKey}-b-pre-${idx}`} style={{ color }}>
            {renderWithItalics(pre, `${baseKey}-b-pre-${idx}`)}
          </Text>
        );
      }
      // bold text (may contain italics inside)
      elements.push(
        <Text key={`${baseKey}-b-${idx}`} style={{ fontWeight: 'bold', color }}>
          {renderWithItalics(inner, `${baseKey}-b-${idx}`)}
        </Text>
      );
      lastIndex = start + full.length;
      idx++;
    }

    // tail (may contain italics)
    if (lastIndex < input.length) {
      const tail = input.slice(lastIndex);
      elements.push(
        <Text key={`${baseKey}-b-tail`} style={{ color }}>
          {renderWithItalics(tail, `${baseKey}-b-tail`)}
        </Text>
      );
    }

    return elements;
  };

  const renderInlineCodeAndText = (input: string) => {
    const parts = input.split('`');
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isCode = i % 2 === 1; // odd indexes are code segments
      if (isCode) {
        nodes.push(
          <Text
            key={`code-${i}`}
            style={{
              fontFamily: 'monospace',
              backgroundColor: codeBg,
              color: codeColor,
              paddingHorizontal: 4,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            {part}
          </Text>
        );
      } else {
        nodes.push(
          <Text key={`txt-${i}`} style={{ color }}>
            {renderWithBold(part, `seg-${i}`)}
          </Text>
        );
      }
    }
    return nodes;
  };

  return <Text>{renderInlineCodeAndText(text)}</Text>;
};

export default MarkdownText;
