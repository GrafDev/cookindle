// Конфигурация приложения Cookindle
export const CONFIG = {
    // Параметры layout
    layout: {
        minWidth: 350,
        maxWidth: 800,
        widthPercent: 90, // процент от viewport width
        heightPercent: 80, // процент от viewport height
        maxHeight: 800,
        padding: 20,
        borderRadius: 10
    },
    
    // Параметры игровой области
    gameArea: {
        borderRadius: 5,
        backgroundColor: '#fafafa'
    },
    
    // Параметры PixiJS
    pixi: {
        backgroundColor: 0x1099bb
    },
    
    // Dev настройки
    dev: {
        showBorders: true,
        showLabels: true,
        consoleLogging: true
    }
};