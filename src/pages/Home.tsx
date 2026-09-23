import { Top, Paragraph, Spacing, ListRow, Asset } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { logClick } from '../lib/analytics';
import { toolMeta, TOOL_ORDER } from '../lib/toolMeta';
import type { ToolType } from '../lib/types';

const TOOL_ICON: Record<ToolType, string> = {
  heic: 'iconImageRegular',
  compress: 'iconCompressRegular',
  'pdf-merge': 'iconDocsRegular',
  'pdf-to-image': 'iconPhotoRegular',
  'pdf-split': 'iconCutRegular',
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
    navigate(toolMeta[tool].route);
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>파일 변환</Top.TitleParagraph>} />}
      bottom={
        <FloatingTabBar
          items={[
            { label: '변환', path: '/' },
            { label: '이력', path: '/history' },
          ]}
        />
      }
    >
      <Spacing size={8} />
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey700)">
        파일은 기기 안에서만 변환돼요. 서버로 올라가지 않아요.
      </Paragraph.Text>
      <Spacing size={16} />

      {TOOL_ORDER.map((tool) => (
        <ListRow
          key={tool}
          onClick={() => selectTool(tool)}
          left={<Asset.ContentIcon name={TOOL_ICON[tool]} alt={toolMeta[tool].title} />}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={toolMeta[tool].title}
              bottom={toolMeta[tool].subtitle}
            />
          }
        />
      ))}

      <Spacing size={80} />
    </ScreenScaffold>
  );
}
