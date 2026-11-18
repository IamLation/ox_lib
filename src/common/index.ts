console.debug = (...data: any[]) =>
  console.log(
    `^5${data.map((value) => (value && typeof value === "object" && JSON.stringify(value, null, 2)) || value)}^0`,
  );
