# SkyOffice Webman

## Getting started

-   develop: yarn dev
-   build: yarn build
-   start: yarn start

## Sử dụng màu cơ bản

-   title : text-foreground
-   description : text-muted-foreground
-   màu chữ primary : text-primary
-   background primary : bg-primary
-   thường dùng background cho các block : bg-card

## Sử dụng icon

-   lucia react : https://lucide.dev/icons/
-   radix icon : https://www.radix-ui.com/icons

## Sử dụng Form

-   libs: https://react-hook-form.com/
-   Input control từ web-ui

## Các components ui/ux

-   https://web-ui.dcorp.com.vn

-   https://ui.shadcn.com

-   https://github.com/shadcn-ui/ui/tree/main/apps/www

## Sử lý query url state

-   libs: https://github.com/47ng/nuqs

-   Single

    ```
    const [searchValue, setSearchValue] = useQueryState("search")
    ```

-   Multiple

    ```
    const [filterParams, setFilterParams] = useQueryStates({
            limit: parseAsInteger.withDefault(limit),
            page: parseAsInteger.withDefault(pageIndex),
            search: parseAsString.withDefault(searchValue || ''),
        })
    ```

## Unit test
-   Sử dụng Vitest: https://vitest.dev/guide/
-   Run ui testing: `yarn test:ui` 
-   Run testing: `yarn test`
-   Run check coverage: `yarn coverage`