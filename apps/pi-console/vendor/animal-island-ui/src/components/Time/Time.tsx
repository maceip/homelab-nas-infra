import React, { useEffect, useState } from 'react';
import styles from './time.module.less';

export type TimeType = 'hud' | 'game';

export interface TimeProps {
    className?: string;
    /** 显示风格：hud（左右结构：星期/日期 + 时间）| game（上下结构：时间 / 分割线 / 日期 + 周几），默认 game */
    type?: TimeType;
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdaysCN = ['日', '一', '二', '三', '四', '五', '六'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const Time: React.FC<TimeProps> = ({ className, type = 'game' }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');

    if (type === 'game') {
        return (
            <div className={`${styles.acDatetimeGame} ${className || ''}`} style={{ padding: 50 }}>
                <div className={styles.gameTime}>
                    {hours}
                    <span className={styles.gameColon}>:</span>
                    {minutes}
                </div>
                <div className={styles.gameDivider} />
                <div className={styles.gameDate}>
                    <span className={styles.gameMonthday}>
                        {currentTime.getMonth() + 1}月{currentTime.getDate()}日
                    </span>
                    <span className={styles.gameWeekday}>{weekdaysCN[currentTime.getDay()]}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.acDatetime} ${className || ''}`}>
            <div className={styles.acDate}>
                <span className={styles.acWeekday}>{weekdays[currentTime.getDay()]}</span>
                <span className={styles.acMonthday}>
                    {months[currentTime.getMonth()]} {currentTime.getDate()}
                </span>
            </div>
            <div className={styles.acTime}>
                {hours}
                <span className={styles.acColon}>:</span>
                {minutes}
            </div>
        </div>
    );
};

Time.displayName = 'Time';
