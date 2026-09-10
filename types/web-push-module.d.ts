declare module "web-push" {
  const webpush: {
    setVapidDetails: (...args: unknown[]) => void;
    sendNotification: (...args: unknown[]) => Promise<unknown>;
  };

  export default webpush;
}
