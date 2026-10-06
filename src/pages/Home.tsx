import { Top, Paragraph, Spacing, ListRow } from '@toss/tds-mobile';
import { Image, Minimize2, Files, FileImage, Scissors, LayoutGrid, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconBadge } from '../components/IconBadge';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { logClick } from '../lib/analytics';
import { toolMeta, TOOL_ORDER } from '../lib/toolMeta';
import type { ToolType } from '../lib/types';

const TOOL_ICON: Record<ToolType, ReactNode> = {
  heic: <Image size={22} />,
  compress: <Minimize2 size={22} />,
  'pdf-merge': <Files size={22} />,
  'pdf-to-image': <FileImage size={22} />,
  'pdf-split': <Scissors size={22} />,
};

export default function Home() {
  const navigate = useNavigate();

  const selectTool = (tool: ToolType) => {
    try {
      generateHapticFeedback({ type: 'tickWeak' });
    } catch {
      /* WebView 밖에서는 throw — 무시 */
    }
    logClick(`tool_select_${tool}`);
    switch (tool) {
      case 'heic':
        navigate('/convert/heic');
        break;
      case 'compress':
        navigate('/convert/compress');
        break;
      case 'pdf-merge':
        navigate('/pdf/merge');
        break;
      case 'pdf-to-image':
        navigate('/pdf/to-image');
        break;
      case 'pdf-split':
        navigate('/pdf/split');
        break;
    }
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>파일 변환</Top.TitleParagraph>} />}
      bottom={
        <FloatingTabBar
          items={[
            { label: '변환', path: '/', icon: <LayoutGrid size={22} /> },
            { label: '이력', path: '/history', icon: <Clock size={22} /> },
          ]}
        />
      }
    >
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey700)">
        파일은 기기 안에서만 변환돼요. 서버로 올라가지 않아요.
      </Paragraph.Text>
      <Spacing size={16} />

      <div style={{ margin: '0 -24px' }}>
      {TOOL_ORDER.map((tool) => (
        <ListRow
          key={tool}
          onClick={() => selectTool(tool)}
          left={<IconBadge>{TOOL_ICON[tool]}</IconBadge>}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={toolMeta[tool].title}
              bottom={toolMeta[tool].subtitle}
            />
          }
        />
      ))}
      </div>

      <Spacing size={80} />
    </ScreenScaffold>
  );
}
