export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <h2 className="text-xl font-semibold mb-4">Not Found</h2>
      <p className="text-muted-foreground mb-4">Could not find requested resource</p>
      <a href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Return Home
      </a>
    </div>
  );
}

