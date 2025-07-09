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
    
    // Параметры печенья
    cookie: {
        painting: "circle", // "circle", "star", "cross"
        patternColor: 0x3C1810, // Цвет узора (темно-коричневый)
        patternCount: 15, // Количество элементов узора
        patternSize: {
            min: 8,
            max: 20
        }
    },
    
    // Параметры иглы
    needle: {
        textureUrl: './src/assets/textures/needle.png',
        mouseOffset: { x: 0, y: 1 }, // Левый нижний угол для мыши
        touchOffset: { x: 0.5, y: 0.5 }, // Центр для пальца
        sizePercent: 50, // Размер иглы в процентах от печенья
        visible: false // Начальная видимость
    },
    
    // Dev настройки
    dev: {
        showBorders: true,
        showLabels: true,
        consoleLogging: true
    }
};