import React from 'react';
import { Time as TimeComponent } from '../../../src';
import {
    CodeBlock,
    ApiTable,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBodyStyle,
    labelStyle,
} from '../../tools';

const TimeDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Time <DemoTag>时间</DemoTag>
        </div>
        <div style={labelStyle}>
            Time 组件 — 经典 HUD 风格时间显示组件，支持 hud（左右）与 game（上下）两种风格（默认 game），实时更新时间。
        </div>
        <div style={demoBodyStyle}>
            <div style={labelStyle}>game 风格（默认）：时间 / 分割线 / 日期 + 周几</div>
            <TimeComponent />
            <div style={labelStyle}>hud 风格：星期/日期 + 时间</div>
            <TimeComponent type="hud" />
        </div>
        <CodeBlock
            code={`import React from 'react';
import { Time } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* game 风格（默认）：时间 / 分割线 / 日期 + 周几 */}
            <Time />
            {/* hud 风格：日期 + 时间 */}
            <Time type="hud" />
        </div>
    );
};

export default App;`}
        />
        <ApiTable rows={TIME_API} />
    </div>
);

const TIME_API: ApiRow[] = [
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    {
        prop: 'type',
        desc: '显示风格：hud（左右结构：星期/日期 + 时间）| game（上下结构：时间 / 分割线 / 日期 + 周几），默认 game',
        type: "'hud' | 'game'",
        defaultVal: "'game'",
    },
];

export default TimeDemo;
