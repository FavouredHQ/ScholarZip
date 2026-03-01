import { useQuery } from "@tanstack/react-query";

interface Country {
  name: string;
  code: string;
}

const fetchCountries = async (): Promise<Country[]> => {
  const res = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
  if (!res.ok) throw new Error("Failed to fetch countries");
  const data = await res.json();
  return data
    .map((c: any) => ({ name: c.name.common as string, code: c.cca2 as string }))
    .sort((a: Country, b: Country) => a.name.localeCompare(b.name));
};

export const useCountries = () => {
  const { data: countries = [], isLoading } = useQuery({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000, // cache for 24h
  });

  return { countries, isLoading };
};
