import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  retry: () => void;
}

export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.errorCard}>
        <Card.Content style={styles.errorContent}>
          <Text variant="headlineSmall" style={[styles.errorTitle, { color: theme.colors.error }]}>
            Something went wrong
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {error?.message || 'An unexpected error occurred'}
          </Text>
          <Button 
            mode="contained" 
            onPress={retry}
            style={styles.retryButton}
            icon="refresh"
          >
            Try Again
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

export const NetworkingErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.errorCard}>
        <Card.Content style={styles.errorContent}>
          <Text variant="headlineSmall" style={[styles.errorTitle, { color: theme.colors.error }]}>
            🤝 Networking Error
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            There was an issue with the networking feature. This might be due to:
          </Text>
          <Text variant="bodySmall" style={styles.errorDetails}>
            • Network connectivity issues{'\n'}
            • Database synchronization problems{'\n'}
            • Missing conversation data for analysis
          </Text>
          <Button 
            mode="contained" 
            onPress={retry}
            style={styles.retryButton}
            icon="refresh"
          >
            Retry Networking
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
  },
  errorContent: {
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.8,
  },
  errorDetails: {
    textAlign: 'left',
    marginBottom: 20,
    opacity: 0.7,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
  },
});
