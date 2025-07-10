import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
  hasGetInitialProps?: boolean;
  err?: Error;
}

function Error({ statusCode, hasGetInitialProps: _hasGetInitialProps, err: _err }: ErrorProps) {
  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      margin: 0,
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', margin: '0 0 1rem 0', color: '#64748b' }}>
          {statusCode || 'Error'}
        </h1>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 2rem 0', fontWeight: 'normal' }}>
          {statusCode
            ? `A ${statusCode} error occurred on server`
            : 'An error occurred on client'}
        </h2>
        <p style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 0 2rem 0' }}>
          {statusCode === 404 
            ? 'This page could not be found.'
            : 'Sorry, something went wrong.'}
        </p>
        <a 
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#334155';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#1e293b';
          }}
        >
          Go back home
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;