import React from 'react';
import { Phone } from '../../../src';
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

const PhoneDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Phone <DemoTag>手机</DemoTag>
        </div>
        <div style={labelStyle}>Phone 组件 — 手机界面组件。</div>
        <div style={{ ...demoBodyStyle, transform: 'scale(0.6)', transformOrigin: 'top left', height: 473 }}>
            <Phone />
        </div>
        <CodeBlock
            code={`import React from 'react';
import { Phone } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* 手机界面 */}
            <Phone />
        </div>
    );
};

export default App;`}
        />
        <ApiTable rows={PHONE_API} />
    </div>
);

const PHONE_API: ApiRow[] = [{ prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' }];

export default PhoneDemo;
