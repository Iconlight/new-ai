import React from 'react';
import { Text, View } from 'react-native';

interface MarkdownTextProps {
  text: string;
  color?: string;
  codeBg?: string;
  codeColor?: string;
}

// Enhanced markdown renderer
// Supports: **bold**, __bold__, *italic*, _italic_, `code`, ### headings, lists, line breaks
export const MarkdownText: React.FC<MarkdownTextProps> = ({ text, color = '#fff', codeBg = '#222', codeColor = '#fff' }) => {
  // Split text into lines for block-level processing
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  
  lines.forEach((line, lineIndex) => {
    // Skip empty lines
    if (!line.trim()) {
      blocks.push(<View key={`empty-${lineIndex}`} style={{ height: 8 }} />);
      return;
    }
    
    // Check for headings (###, ##, #)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const fontSize = level === 1 ? 20 : level === 2 ? 18 : 16;
      blocks.push(
        <View key={`heading-${lineIndex}`} style={{ marginVertical: 6 }}>
          <Text style={{ fontSize, fontWeight: 'bold', color }}>
            {renderInlineMarkdown(headingText, `h${level}-${lineIndex}`, color, codeBg, codeColor)}
          </Text>
        </View>
      );
      return;
    }
    
    // Check for bullet lists (-, *, •)
    const bulletMatch = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bulletMatch) {
      const bulletText = bulletMatch[1];
      blocks.push(
        <View key={`bullet-${lineIndex}`} style={{ flexDirection: 'row', marginVertical: 2 }}>
          <Text style={{ color, marginRight: 8 }}>•</Text>
          <Text style={{ flex: 1, color }}>
            {renderInlineMarkdown(bulletText, `bullet-${lineIndex}`, color, codeBg, codeColor)}
          </Text>
        </View>
      );
      return;
    }
    
    // Check for numbered lists (1., 2., etc.)
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const number = numberedMatch[1];
      const listText = numberedMatch[2];
      blocks.push(
        <View key={`numbered-${lineIndex}`} style={{ flexDirection: 'row', marginVertical: 2 }}>
          <Text style={{ color, marginRight: 8 }}>{number}.</Text>
          <Text style={{ flex: 1, color }}>
            {renderInlineMarkdown(listText, `numbered-${lineIndex}`, color, codeBg, codeColor)}
          </Text>
        </View>
      );
      return;
    }
    
    // Regular paragraph
    blocks.push(
      <Text key={`line-${lineIndex}`} style={{ color, marginVertical: 2 }}>
        {renderInlineMarkdown(line, `line-${lineIndex}`, color, codeBg, codeColor)}
      </Text>
    );
  });
  
  return <View>{blocks}</View>;
};

// Helper function to render inline markdown (bold, italic, code)
function renderInlineMarkdown(text: string, baseKey: string, color: string, codeBg: string, codeColor: string) {
  const renderWithItalics = (input: string, baseKey: string, textColor: string) => {
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
          <Text key={`${baseKey}-i-pre-${idx}`} style={{ color: textColor }}>
            {input.slice(lastIndex, start)}
          </Text>
        );
      }
      // italic text
      elements.push(
        <Text key={`${baseKey}-i-${idx}`} style={{ fontStyle: 'italic', color: textColor }}>
          {inner}
        </Text>
      );
      lastIndex = start + full.length;
      idx++;
    }

    // tail text
    if (lastIndex < input.length) {
      elements.push(
        <Text key={`${baseKey}-i-tail`} style={{ color: textColor }}>
          {input.slice(lastIndex)}
        </Text>
      );
    }

    return elements;
  };

  const renderWithBold = (input: string, baseKey: string, textColor: string) => {
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
          <Text key={`${baseKey}-b-pre-${idx}`} style={{ color: textColor }}>
            {renderWithItalics(pre, `${baseKey}-b-pre-${idx}`, textColor)}
          </Text>
        );
      }
      // bold text (may contain italics inside)
      elements.push(
        <Text key={`${baseKey}-b-${idx}`} style={{ fontWeight: 'bold', color: textColor }}>
          {renderWithItalics(inner, `${baseKey}-b-${idx}`, textColor)}
        </Text>
      );
      lastIndex = start + full.length;
      idx++;
    }

    // tail (may contain italics)
    if (lastIndex < input.length) {
      const tail = input.slice(lastIndex);
      elements.push(
        <Text key={`${baseKey}-b-tail`} style={{ color: textColor }}>
          {renderWithItalics(tail, `${baseKey}-b-tail`, textColor)}
          </Text>
      );
    }

    return elements;
  };

  const parts = text.split('`');
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isCode = i % 2 === 1; // odd indexes are code segments
    if (isCode) {
      nodes.push(
        <Text
          key={`${baseKey}-code-${i}`}
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
        <Text key={`${baseKey}-txt-${i}`} style={{ color }}>
          {renderWithBold(part, `${baseKey}-seg-${i}`, color)}
        </Text>
      );
    }
  }
  return nodes;
}

export default MarkdownText;
