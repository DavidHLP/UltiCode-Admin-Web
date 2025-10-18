import type { ComputedRef, Ref } from 'vue';
import { inject } from 'vue';

export interface StatementForm {
    id?: number;
    langCode: string;
    title: string;
    descriptionMd: string;
    constraintsMd?: string | null;
    examplesMd?: string | null;
}

export interface LanguageConfigForm {
    id?: number;
    languageId: number | null;
    functionName?: string | null;
    starterCode?: string | null;
}

export interface ProblemForm {
    slug: string;
    problemType: string;
    difficultyId: number | null;
    categoryId: number | null;
    creatorId: number | null;
    solutionEntry: string;
    timeLimitMs: number | null;
    memoryLimitKb: number | null;
    isPublic: boolean;
    tagIds: number[];
    statements: StatementForm[];
    languageConfigs: LanguageConfigForm[];
    metaText: string;
}

export interface SelectionOption<T = unknown> {
    label: string;
    value: T;
}

export interface ProblemEditorContext {
    form: ProblemForm;
    loading: Ref<boolean>;
    saving: Ref<boolean>;
    initialised: Ref<boolean>;
    saveDisabled: ComputedRef<boolean>;
    isEditMode: ComputedRef<boolean>;
    activeStatementIndex: Ref<number>;
    activeStatement: ComputedRef<StatementForm | null>;
    problemTypeOptions: ComputedRef<SelectionOption<string>[]>;
    difficultyOptions: ComputedRef<SelectionOption<number | null>[]>;
    categoryOptions: ComputedRef<SelectionOption<number | null>[]>;
    tagSelectOptions: ComputedRef<SelectionOption<number>[]>;
    languageSelectOptions: ComputedRef<SelectionOption<number>[]>;
    markdownPlugins: unknown[];
    codeEditorOptions: Record<string, unknown>;
    jsonEditorOptions: Record<string, unknown>;
    goBack: () => void;
    formatMetaJson: () => void;
    submitForm: () => Promise<void>;
    addStatement: (afterIndex?: number) => void;
    duplicateStatement: (index: number) => void;
    moveStatement: (index: number, offset: number) => void;
    removeStatement: (index: number) => boolean;
    statementTitle: (index: number) => string;
    statementLanguageLabel: (statement: StatementForm) => string;
    setActiveStatement: (index: number) => void;
    updateStatementMarkdown: (field: 'descriptionMd' | 'constraintsMd' | 'examplesMd', value: string) => void;
    addLanguageConfig: (afterIndex?: number) => void;
    duplicateLanguageConfig: (index: number) => void;
    moveLanguageConfig: (index: number, offset: number) => void;
    removeLanguageConfig: (index: number) => void;
    editorLanguageForConfig: (config: LanguageConfigForm) => string;
    getLanguageDisplayName: (languageId: number | null) => string;
}

export const problemEditorSymbol = Symbol('problemEditor');

export function useProblemEditorContext(): ProblemEditorContext {
    const context = inject<ProblemEditorContext | null>(problemEditorSymbol, null);
    if (!context) {
        throw new Error('ProblemEditorContext is not provided');
    }
    return context;
}