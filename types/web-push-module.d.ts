declare module "web-push" {
  const webpush: {
    setVapidDetails: (...args: any[]) => void;
    sendNotification: (...args: any[]) => Promise<unknown>;
  };

  export default webpush;
}
