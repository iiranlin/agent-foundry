import { useTranslations } from 'next-intl';
import { AppConfig } from '@/utils/AppConfig';

export const BaseTemplate = (props: {
  leftNav: React.ReactNode;
  rightNav?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const t = useTranslations('BaseTemplate');

  return (
    <div className="overflow-x-hidden bg-slate-100 px-3 text-slate-700 antialiased sm:px-5">
      <div className="mx-auto w-full max-w-[calc(100vw-1.5rem)] sm:max-w-7xl">
        <header className="border-b border-gray-300">
          <div className="pt-8 pb-5">
            <h1 className="text-2xl font-bold text-slate-950">{AppConfig.name}</h1>
            <h2 className="mt-1 text-sm break-words text-slate-500">{t('description')}</h2>
          </div>

          <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:justify-between">
            <nav aria-label={t('main_navigation_label')}>
              <ul className="flex flex-wrap gap-x-5 text-sm">{props.leftNav}</ul>
            </nav>

            <nav>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">{props.rightNav}</ul>
            </nav>
          </div>
        </header>

        <main>{props.children}</main>

        <footer className="border-t border-gray-300 py-8 text-center text-sm">
          {t('footer_text', {
            year: new Date().getFullYear(),
            name: AppConfig.name,
          })}
        </footer>
      </div>
    </div>
  );
};
