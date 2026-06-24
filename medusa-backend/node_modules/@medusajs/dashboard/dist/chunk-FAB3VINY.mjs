import {
  queryClient
} from "./chunk-FXYH54JP.mjs";
import {
  queryKeysFactory
} from "./chunk-774WSTCC.mjs";
import {
  sdk
} from "./chunk-NFEK63OE.mjs";

// src/hooks/api/translations.tsx
import {
  useInfiniteQuery,
  useMutation,
  useQuery
} from "@tanstack/react-query";
var TRANSLATIONS_QUERY_KEY = "translations";
var translationsQueryKeys = queryKeysFactory(TRANSLATIONS_QUERY_KEY);
var TRANSLATION_SETTINGS_QUERY_KEY = "translation_settings";
var translationSettingsQueryKeys = queryKeysFactory(
  TRANSLATION_SETTINGS_QUERY_KEY
);
var TRANSLATION_STATISTICS_QUERY_KEY = "translation_statistics";
var translationStatisticsQueryKeys = queryKeysFactory(
  TRANSLATION_STATISTICS_QUERY_KEY
);
var TRANSLATION_ENTITIES_QUERY_KEY = "translation_entities";
var translationEntitiesQueryKeys = queryKeysFactory(
  TRANSLATION_ENTITIES_QUERY_KEY
);
var DEFAULT_PAGE_SIZE = 20;
var useReferenceTranslations = (reference, referenceId, options) => {
  const { data, ...rest } = useInfiniteQuery({
    queryKey: translationEntitiesQueryKeys.list({
      type: reference,
      id: referenceId
    }),
    queryFn: async ({ pageParam = 0 }) => {
      return sdk.admin.translation.entities({
        type: reference,
        id: referenceId,
        limit: DEFAULT_PAGE_SIZE,
        offset: pageParam
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.count ? nextOffset : void 0;
    },
    ...options
  });
  const entitiesWithTranslations = data?.pages.flatMap((page) => page.data) ?? [];
  const translations = entitiesWithTranslations.flatMap(
    (entity) => entity.translations ?? []
  );
  const references = entitiesWithTranslations.map(
    ({ translations: _, ...entity }) => entity
  );
  const count = data?.pages[0]?.count ?? 0;
  return {
    references,
    translations,
    count,
    ...rest
  };
};
var useBatchTranslations = (reference, options) => {
  const mutation = useMutation({
    mutationFn: (payload) => sdk.admin.translation.batch(payload),
    ...options
  });
  const invalidateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: translationEntitiesQueryKeys.list({ type: reference })
      }),
      queryClient.invalidateQueries({
        queryKey: translationStatisticsQueryKeys.lists()
      })
    ]);
  };
  return {
    ...mutation,
    invalidateQueries
  };
};
var useTranslationSettings = (query, options) => {
  const { data, ...rest } = useQuery({
    queryKey: translationSettingsQueryKeys.list(query),
    queryFn: () => sdk.admin.translation.settings(query),
    ...options
  });
  return { ...data, ...rest };
};
var useBatchTranslationSettings = (options) => {
  return useMutation({
    mutationFn: (payload) => sdk.admin.translation.batchSettings(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: translationSettingsQueryKeys.lists()
      });
      queryClient.invalidateQueries({
        queryKey: translationStatisticsQueryKeys.lists()
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options
  });
};
var useTranslationStatistics = (query, options) => {
  const { data, ...rest } = useQuery({
    queryKey: translationStatisticsQueryKeys.list(query),
    queryFn: () => sdk.admin.translation.statistics(query),
    ...options
  });
  return { ...data, ...rest };
};

export {
  useReferenceTranslations,
  useBatchTranslations,
  useTranslationSettings,
  useBatchTranslationSettings,
  useTranslationStatistics
};
