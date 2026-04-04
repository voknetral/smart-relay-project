import { APP_DEFAULTS } from '@/constants/Config';
import { AppLanguage, getTranslations, TranslationShape } from '@/constants/translations';
import { Storage } from '@/utils/storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface LanguageContextValue {
    language: AppLanguage;
    setLanguage: (language: AppLanguage) => void;
    TXT: TranslationShape;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<AppLanguage>(APP_DEFAULTS.language);

    useEffect(() => {
        const loadLanguage = async () => {
            const config = await Storage.loadConfig();
            if (config?.language) {
                setLanguage(config.language);
            }
        };

        loadLanguage();
    }, []);

    const value = useMemo(() => ({
        language,
        setLanguage,
        TXT: getTranslations(language),
    }), [language]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
