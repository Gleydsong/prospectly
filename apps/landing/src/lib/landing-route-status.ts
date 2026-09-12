export const LANDING_ROUTE_STATUS = {
  pt: {
    skip: 'Pular para o conteúdo principal',
    notFound: {
      kicker: 'PÁGINA NÃO ENCONTRADA',
      title: 'Esta página não existe.',
      body: 'O endereço pode ter mudado ou nunca existiu. Volte para a home e continue de onde parou.',
      homeLabel: 'Voltar ao início',
      homeHref: '/',
    },
    error: {
      kicker: 'ALGO DEU ERRADO',
      title: 'Não foi possível abrir esta página.',
      body: 'Tente de novo. Se o problema continuar, volte à home.',
      retryLabel: 'Tentar de novo',
      homeLabel: 'Voltar ao início',
      homeHref: '/',
    },
    loading: {
      label: 'Carregando a página',
    },
  },
  en: {
    skip: 'Skip to main content',
    notFound: {
      kicker: 'PAGE NOT FOUND',
      title: 'This page does not exist.',
      body: 'The address may have changed or never existed. Go back home to keep prospecting.',
      homeLabel: 'Back to home',
      homeHref: '/en',
    },
    error: {
      kicker: 'SOMETHING WENT WRONG',
      title: 'This page could not be opened.',
      body: 'Try again. If it keeps happening, go back home.',
      retryLabel: 'Try again',
      homeLabel: 'Back to home',
      homeHref: '/en',
    },
    loading: {
      label: 'Loading the page',
    },
  },
} as const;
