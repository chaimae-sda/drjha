import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock3, Heart, HelpCircle, MoreVertical, Search, SquareArrowOutUpRight, Star, Trash2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';
import { libraryService } from '../services/libraryService';

const Library = ({ onSelectText }) => {
  const { t, formatDate } = useI18n();
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('saved');
  const [menuTextId, setMenuTextId] = useState(null);
  const resources = useMemo(() => libraryService.getResources(t), [t]);

  const filterLabels = {
    all: t('library.filters.all'),
    favorites: t('library.filters.favorites'),
    scans: t('library.filters.scans'),
    uploads: t('library.filters.uploads'),
  };

  useEffect(() => {
    const loadTexts = async () => {
      setLoading(true);
      const data = await apiClient.getTexts();
      setTexts(Array.isArray(data) ? data : []);
      setLoading(false);
    };

    loadTexts();
  }, []);

  const filteredTexts = useMemo(
    () =>
      texts.filter((text) => {
        const haystack = `${text.title} ${text.originalText}`.toLowerCase();
        const matchesSearch = haystack.includes(searchTerm.toLowerCase());
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'favorites' && text.isFavorite) ||
          (activeFilter === 'scans' && text.source === 'scan') ||
          (activeFilter === 'uploads' && text.source === 'upload');

        return matchesSearch && matchesFilter;
      }),
    [activeFilter, searchTerm, texts],
  );

  const handleToggleFavorite = async (event, textId) => {
    event.stopPropagation();
    const response = await apiClient.toggleFavorite(textId);
    if (!response.error) {
      setTexts((current) =>
        current.map((item) => (item._id === textId ? { ...item, isFavorite: response.isFavorite } : item)),
      );
    }
    setMenuTextId(null);
  };

  const handleDelete = async (event, textId) => {
    event.stopPropagation();
    const response = await apiClient.deleteText(textId);
    if (!response.error) {
      setTexts((current) => current.filter((item) => item._id !== textId));
    }
    setMenuTextId(null);
  };

  return (
    <section className="screen screen--library">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('library.eyebrow')}</p>
        </div>
      </header>

      <div className="section-toggle">
        <button
          type="button"
          className={`section-toggle__button ${activeSection === 'saved' ? 'is-active' : ''}`}
          onClick={() => setActiveSection('saved')}
        >
          {t('library.sections.saved')}
        </button>
        <button
          type="button"
          className={`section-toggle__button ${activeSection === 'learn' ? 'is-active' : ''}`}
          onClick={() => setActiveSection('learn')}
        >
          {t('library.sections.learn')}
        </button>
      </div>

      {activeSection === 'saved' ? (
        <>
          <div className="search-card">
            <Search size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('library.searchPlaceholder')}
            />
          </div>

          <div className="filter-row">
            {Object.entries(filterLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-chip ${activeFilter === key ? 'is-active' : ''}`}
                onClick={() => setActiveFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="library-list">
            {loading && <div className="empty-state">{t('library.loading')}</div>}

            {!loading && filteredTexts.length === 0 && (
              <div className="empty-state">
                <strong>{t('library.emptyTitle')}</strong>
                <span>{t('library.emptyBody')}</span>
              </div>
            )}

            {!loading &&
              filteredTexts.map((text) => (
                <div
                  key={text._id}
                  className="library-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectText(text._id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectText(text._id);
                    }
                  }}
                >
                  <div className="library-card__top">
                    <span className={`source-pill source-pill--${text.source === 'scan' ? 'scan' : 'upload'}`}>
                      {text.source === 'scan' ? t('library.sourceScan') : t('library.sourceUpload')}
                    </span>
                    <div className="library-card__actions">
                      <button
                        type="button"
                        className={`favorite-pill ${text.isFavorite ? 'is-active' : ''}`}
                        onClick={(event) => handleToggleFavorite(event, text._id)}
                        aria-label={text.isFavorite ? t('library.removeFavorite') : t('library.addFavorite')}
                      >
                        <Heart size={14} fill={text.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="library-more"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuTextId((current) => (current === text._id ? null : text._id));
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  {menuTextId === text._id && (
                    <div className="library-action-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={(event) => handleToggleFavorite(event, text._id)}>
                        <Star size={14} />
                        <span>{text.isFavorite ? t('library.removeFavorite') : t('library.addFavorite')}</span>
                      </button>
                      <button type="button" className="is-danger" onClick={(event) => handleDelete(event, text._id)}>
                        <Trash2 size={14} />
                        <span>{t('library.delete')}</span>
                      </button>
                    </div>
                  )}

                  <div className="library-card__body">
                    <h3>{text.title}</h3>
                    <p>{text.originalText}</p>
                    {text.fileName && <small className="library-card__file">{text.fileName}</small>}
                  </div>

                  <div className="library-card__footer">
                    <span>
                      <Clock3 size={14} />
                      {formatDate(text.createdAt)}
                    </span>
                    <span>
                      <BookOpen size={14} />
                      {text.readCount || 0} {t('library.views')}
                    </span>
                    <span>
                      <HelpCircle size={14} />
                      {(text.generatedQuestions || []).length} questions
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : (
        <section className="resource-section">
          <div className="section-head">
            <h3>{t('library.resourcesTitle')}</h3>
          </div>
          <p className="resource-section__intro">{t('library.resourcesIntro')}</p>

          <div className="resource-grid">
            {resources.map((resource) => (
              <article key={resource.id} className="resource-card">
                <div className="resource-card__top">
                  <span className="resource-card__icon" style={{ background: `${resource.color}18`, color: resource.color }}>
                    {resource.icon}
                  </span>
                  <span className="resource-badge">{t('library.offlineReady')}</span>
                </div>
                <div className="resource-card__body">
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                </div>
                <div className="resource-links">
                  {resource.links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="resource-link">
                      <span>{link.name}</span>
                      <SquareArrowOutUpRight size={14} />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
};

export default Library;
